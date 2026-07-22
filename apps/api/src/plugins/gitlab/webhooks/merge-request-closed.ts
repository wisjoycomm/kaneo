import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerNamespace,
} from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type MRClosedPayload = {
  object_attributes: {
    iid: number;
    state: string;
    action?: string;
  };
  project: {
    path_with_namespace?: string;
    namespace?: { path?: string; full_path?: string };
    name: string;
    web_url: string;
  };
};

export async function handleGitlabMergeRequestClosed(
  payload: MRClosedPayload,
  integrationId?: string,
) {
  const { object_attributes: mr, project } = payload;
  const merged = mr.action === "merge";

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
    const config = JSON.parse(integration.config) as GitlabConfig;

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, mr.iid.toString()),
      ),
    });
    if (!externalLink) continue;

    const task = await findTaskById(externalLink.taskId);
    if (!task) continue;

    const existingMetadata = externalLink.metadata
      ? (JSON.parse(externalLink.metadata) as Record<string, unknown>)
      : {};

    await updateExternalLink(externalLink.id, {
      metadata: { ...existingMetadata, state: "closed", merged },
    });

    if (merged) {
      const allTaskMRs = await db.query.externalLinkTable.findMany({
        where: and(
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "pull_request"),
        ),
      });

      const hasOpenMRs = allTaskMRs.some((link) => {
        if (link.id === externalLink.id) return false;
        const metadata = link.metadata
          ? (JSON.parse(link.metadata) as Record<string, unknown>)
          : {};
        return metadata.state === "opened";
      });

      if (!hasOpenMRs) {
        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "pr_merged",
          config.statusTransitions?.onPRMerge || "done",
        );
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
    }

    return;
  }
}
