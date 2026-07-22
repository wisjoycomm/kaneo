import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerNamespace,
} from "../services/integration-lookup";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type NoteCreatedPayload = {
  object_attributes: {
    noteable_type: string;
    note: string;
    url: string;
    created_at: string;
  };
  issue?: {
    iid: number;
  };
  user?: {
    username?: string;
    avatar_url?: string;
  } | null;
  project: {
    path_with_namespace?: string;
    namespace?: { path?: string; full_path?: string };
    name: string;
    web_url: string;
  };
};

export async function handleGitlabIssueCommentCreated(
  payload: NoteCreatedPayload,
  integrationId?: string,
) {
  const { object_attributes: note, issue, project } = payload;

  // GitLab's Note Hook fires for issues, merge requests, commits, and
  // snippets alike — only issue comments map to a Kaneo task.
  if (note.noteable_type !== "Issue" || !issue) {
    return;
  }

  const username = payload.user?.username ?? "";
  if (username.endsWith("[bot]")) {
    return;
  }

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
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (!existingLink) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId: existingLink.taskId,
        type: "comment",
        content: note.note,
        externalUserName: username || "Unknown",
        externalUserAvatar: payload.user?.avatar_url ?? null,
        externalSource: "gitlab",
        externalUrl: note.url,
        eventData: {
          externalNoteCreatedAt: note.created_at,
        },
      })
      .onConflictDoNothing({
        target: [
          activityTable.taskId,
          activityTable.externalSource,
          activityTable.externalUrl,
        ],
      });
  }
}
