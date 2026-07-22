import { publishEvent } from "../../../events";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerNamespace,
} from "../services/integration-lookup";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type MROpenedPayload = {
  action: string;
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    source_branch: string;
    state: string;
  };
  user?: { username?: string } | null;
  project: {
    path_with_namespace?: string;
    namespace?: { path?: string; full_path?: string };
    name: string;
    web_url: string;
  };
};

export async function handleGitlabMergeRequestOpened(
  payload: MROpenedPayload,
  integrationId?: string,
) {
  const { object_attributes: mr, project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(project.web_url);
  if (!baseUrl) return;

  const owner = repoOwnerNamespace(project);
  const integrations = await findAllIntegrationsByGitlabRepo(
    baseUrl,
    owner,
    project.name,
    integrationId,
  );

  for (const integration of integrations) {
    if (!integration.project) continue;

    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;

    const taskNumber = extractTaskNumberGitlab(
      mr.source_branch,
      mr.title,
      mr.description ?? undefined,
      config,
      projectSlug,
    );
    if (!taskNumber) continue;

    const task = await findTaskByNumber(integration.projectId, taskNumber);
    if (!task) continue;

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      mr.iid.toString(),
    );
    if (existingLink) continue;

    await createExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "pull_request",
      externalId: mr.iid.toString(),
      url: mr.url,
      title: mr.title,
      metadata: {
        state: mr.state,
        branch: mr.source_branch,
        author: payload.user?.username,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_opened",
      config.statusTransitions?.onPROpen || "in-review",
    );

    const isTaskFinal = await isTaskInFinalState(task);
    if (task.status !== targetStatus && !isTaskFinal) {
      const statusResult = await updateTaskStatus(task.id, targetStatus);
      if (
        statusResult.applied &&
        statusResult.before.status !== statusResult.after.status
      ) {
        await publishEvent("task.status_changed", {
          taskId: statusResult.after.id,
          projectId: statusResult.after.projectId,
          userId: null,
          oldStatus: statusResult.before.status,
          newStatus: statusResult.after.status,
          title: statusResult.after.title,
          assigneeId: statusResult.after.userId,
          type: "status_changed",
        });
      }
    }

    return;
  }
}
