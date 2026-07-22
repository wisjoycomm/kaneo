import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export async function findAllIntegrationsByGitlabRepo(
  baseUrl: string,
  owner: string,
  repo: string,
  integrationId?: string,
) {
  const normalized = normalizeGitlabBaseUrl(baseUrl);
  const conditions = [
    eq(integrationTable.type, "gitlab"),
    eq(integrationTable.isActive, true),
  ];
  if (integrationId) {
    conditions.push(eq(integrationTable.id, integrationId));
  }

  const integrations = await db.query.integrationTable.findMany({
    where: and(...conditions),
    with: {
      project: true,
    },
  });

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitlabConfig;
      const matches =
        normalizeGitlabBaseUrl(config.baseUrl) === normalized &&
        config.repositoryOwner === owner &&
        config.repositoryName === repo;
      if (integrationId && !matches) {
        console.warn(
          "[GitLab Webhook] Signed integration repository mismatch",
          { integrationId },
        );
      }
      return matches;
    } catch {
      return false;
    }
  });
}

export function repoOwnerNamespace(project: {
  path_with_namespace?: string;
  namespace?: { path?: string; full_path?: string };
}): string {
  if (project.namespace?.full_path) return project.namespace.full_path;
  if (project.namespace?.path) return project.namespace.path;
  if (project.path_with_namespace) {
    return project.path_with_namespace.split("/").slice(0, -1).join("/");
  }
  return "";
}
