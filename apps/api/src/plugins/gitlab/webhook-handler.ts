import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { verifyGitlabToken } from "./utils/verify-token";
import { handleGitlabIssueClosed } from "./webhooks/issue-closed";
import { handleGitlabIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import { handleGitlabIssueReopened } from "./webhooks/issue-reopened";
import { handleGitlabMergeRequestClosed } from "./webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "./webhooks/merge-request-opened";
import { handleGitlabPush } from "./webhooks/push";

type GitlabPushPayload = Parameters<typeof handleGitlabPush>[0];
type GitlabMRPayload = Parameters<typeof handleGitlabMergeRequestOpened>[0];
type GitlabMRClosedPayload = Parameters<
  typeof handleGitlabMergeRequestClosed
>[0];
type GitlabIssuePayload = Parameters<typeof handleGitlabIssueOpened>[0];
type GitlabIssueClosedPayload = Parameters<typeof handleGitlabIssueClosed>[0];
type GitlabIssueReopenedPayload = Parameters<
  typeof handleGitlabIssueReopened
>[0];
type GitlabNoteCreatedPayload = Parameters<
  typeof handleGitlabIssueCommentCreated
>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProject(value: Record<string, unknown>) {
  return isRecord(value.project);
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is GitlabPushPayload {
  return typeof payload.ref === "string" && hasProject(payload);
}

function isMRPayload(
  payload: Record<string, unknown>,
): payload is GitlabMRPayload {
  return hasProject(payload) && isRecord(payload.object_attributes);
}

function isIssuePayload(
  payload: Record<string, unknown>,
): payload is GitlabIssuePayload {
  return hasProject(payload) && isRecord(payload.object_attributes);
}

function isNotePayload(
  payload: Record<string, unknown>,
): payload is GitlabNoteCreatedPayload {
  return hasProject(payload) && isRecord(payload.object_attributes);
}

export async function handleGitlabWebhookRequest(
  integrationId: string,
  rawBody: string,
  tokenHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (integration?.type !== "gitlab") {
    return { success: false, error: "GitLab integration not found" };
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyGitlabToken(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token" };
  }

  const event = eventHeader || undefined;
  if (!event) {
    return { success: false, error: "Missing event name" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    await dispatchGitlabEvent(event, payload, integration.id);
    return { success: true };
  } catch (error) {
    console.error("[GitLab Webhook] Handler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handler failed",
    };
  }
}

async function dispatchGitlabEvent(
  event: string,
  payload: Record<string, unknown>,
  integrationId: string,
) {
  console.log(`[GitLab Webhook] Event: ${event}`);

  switch (event) {
    case "Push Hook":
      if (isPushPayload(payload)) {
        await handleGitlabPush(payload, integrationId);
      }
      return;
    case "Merge Request Hook": {
      if (!isMRPayload(payload)) return;
      const action = (payload.object_attributes as { action?: string }).action;
      if (action === "open" || action === "reopen") {
        await handleGitlabMergeRequestOpened(payload, integrationId);
      } else if (action === "close" || action === "merge") {
        await handleGitlabMergeRequestClosed(
          payload as unknown as GitlabMRClosedPayload,
          integrationId,
        );
      }
      return;
    }
    case "Issue Hook": {
      if (!isIssuePayload(payload)) return;
      const action = (payload.object_attributes as { action?: string }).action;
      if (action === "open") {
        await handleGitlabIssueOpened(payload, integrationId);
      } else if (action === "reopen") {
        await handleGitlabIssueReopened(
          payload as unknown as GitlabIssueReopenedPayload,
          integrationId,
        );
      } else if (action === "close") {
        await handleGitlabIssueClosed(
          payload as unknown as GitlabIssueClosedPayload,
          integrationId,
        );
      }
      return;
    }
    case "Note Hook":
      if (isNotePayload(payload)) {
        await handleGitlabIssueCommentCreated(payload, integrationId);
      }
      return;
    default:
      // GitLab has no dedicated "label created" webhook event (unlike
      // GitHub/Gitea) — label sync stays outbound-only for this plugin.
      console.log(`[GitLab Webhook] Ignored event: ${event}`);
  }
}
