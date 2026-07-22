import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerNamespace,
} from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueReopenedPayload = {
  object_attributes: { iid: number; action?: string };
  project: {
    path_with_namespace?: string;
    namespace?: { path?: string; full_path?: string };
    name: string;
    web_url: string;
  };
};

export async function handleGitlabIssueReopened(
  payload: IssueReopenedPayload,
  integrationId?: string,
) {
  if (payload.object_attributes.action !== "reopen") return;

  const { object_attributes: issue, project } = payload;
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
    try {
      const externalLink = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(externalLinkTable.integrationId, integration.id),
          eq(externalLinkTable.resourceType, "issue"),
          eq(externalLinkTable.externalId, issue.iid.toString()),
        ),
      });
      if (!externalLink) continue;

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, externalLink.taskId),
      });
      if (!task) continue;

      const targetStatus = await resolveTargetStatus(
        task.projectId,
        "issue_reopened",
        "to-do",
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

      const existingMetadata = externalLink.metadata
        ? (JSON.parse(externalLink.metadata) as Record<string, unknown>)
        : {};
      await updateExternalLink(externalLink.id, {
        metadata: { ...existingMetadata, state: "opened" },
      });
    } catch (error) {
      console.error("GitLab issue reopen handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        error,
      });
    }
  }
}
