import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

const DEVELOPER_ACCESS_LEVEL = 30;

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
}: {
  baseUrl: string;
  accessToken: string;
  repositoryOwner: string;
  repositoryName: string;
}) {
  try {
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    await verifyGitlabToken(normalized, accessToken);

    const client = createGitlabClient({ baseUrl: normalized, accessToken });
    const project = await client.getProject(repositoryOwner, repositoryName);

    const accessLevel = Math.max(
      project.permissions?.project_access?.access_level ?? 0,
      project.permissions?.group_access?.access_level ?? 0,
    );
    const hasIssuesWrite = accessLevel >= DEVELOPER_ACCESS_LEVEL;

    return {
      isInstalled: true,
      hasRequiredPermissions: hasIssuesWrite,
      repositoryExists: true,
      repositoryPrivate: project.visibility !== "public",
      missingPermissions: hasIssuesWrite ? [] : ["issues (write)"],
      message: hasIssuesWrite
        ? "Token can access the project."
        : "Token may not have sufficient permissions to manage issues.",
    };
  } catch (error) {
    const err = error as { status?: number; message?: string };

    if (err.status === 404) {
      return {
        isInstalled: false,
        hasRequiredPermissions: false,
        repositoryExists: false,
        repositoryPrivate: null,
        missingPermissions: [] as string[],
        message: "Project not found or not accessible with this token.",
      };
    }

    if (err.status === 401) {
      throw new HTTPException(401, {
        message: "Invalid GitLab token or unauthorized.",
      });
    }

    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify GitLab access",
    });
  }
}

export default verifyGitlabAccess;
