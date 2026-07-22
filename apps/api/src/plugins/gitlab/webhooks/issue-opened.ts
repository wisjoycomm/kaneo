import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, projectTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import getNextTaskNumber from "../../../task/controllers/get-next-task-number";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GitlabConfig } from "../config";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerNamespace,
} from "../services/integration-lookup";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueOpenedPayload = {
  action: string;
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
  };
  labels?: Array<{ title: string }>;
  user?: { username?: string } | null;
  project: {
    path_with_namespace?: string;
    namespace?: { path?: string; full_path?: string };
    name: string;
    web_url: string;
  };
};

export async function handleGitlabIssueOpened(
  payload: IssueOpenedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(project.web_url);
  if (!baseUrl) return;

  const owner = repoOwnerNamespace(project);
  const repoName = project.name;
  const integrations = await findAllIntegrationsByGitlabRepo(
    baseUrl,
    owner,
    repoName,
    integrationId,
  );

  if (integrations.length === 0) return;

  for (const integration of integrations) {
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
    const projectId = integration.projectId;

    const labelNames = (payload.labels ?? []).map((l) => l.title);
    const priority = extractIssuePriority(labelNames);
    const status = extractIssueStatus(labelNames);

    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );
    if (existingLink) continue;

    const nextTaskNumber = await getNextTaskNumber(projectId);

    const resolvedStatus = await resolveTargetStatus(
      projectId,
      "issue_opened",
      status || "to-do",
    );

    const targetColumn = await db.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, projectId),
        eq(columnTable.slug, resolvedStatus),
      ),
    });

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
      status: resolvedStatus,
      columnId: targetColumn?.id ?? null,
      priority: priority ?? null,
      number: nextTaskNumber + 1,
    };

    const [createdTask] = await db
      .insert(taskTable)
      .values(taskValues)
      .returning();

    if (!createdTask) {
      console.error("Failed to create task from GitLab issue");
      continue;
    }

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "gitlab",
      externalId: issue.iid.toString(),
      actor: payload.user?.username ?? "gitlab-webhook",
    });

    await createExternalLink({
      taskId: createdTask.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: issue.iid.toString(),
      url: issue.url,
      title: issue.title,
      metadata: {
        state: "opened",
        createdFrom: "gitlab",
        author: payload.user?.username,
      },
    });

    const kanoeProject = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });
    if (!kanoeProject) continue;

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${kanoeProject.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${kanoeProject.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const labelsToAdd: string[] = [];
      if (priority && !labelNames.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }
      if (status && !labelNames.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }
      if (labelsToAdd.length > 0) {
        await addLabelsToIssueGitlab(config, issue.iid, labelsToAdd);
      }

      if (config.commentTaskLinkOnGitlabIssue !== false) {
        const client = createGitlabClient(config);
        await client.createIssueNote(
          config.repositoryOwner,
          config.repositoryName,
          issue.iid,
          `[${taskIdentifier}](${taskUrl})`,
        );
      }
    } catch (error) {
      console.error("Failed to process GitLab issue:", error);
    }
  }
}
