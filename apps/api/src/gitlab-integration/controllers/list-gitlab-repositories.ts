import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

type RepoRow = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
  html_url: string;
};

async function listGitlabRepositories({
  baseUrl,
  accessToken,
}: {
  baseUrl: string;
  accessToken: string;
}): Promise<{ repositories: RepoRow[] }> {
  const normalized = normalizeGitlabBaseUrl(baseUrl);

  try {
    await verifyGitlabToken(normalized, accessToken);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid GitLab token or could not reach instance.",
    });
  }

  const client = createGitlabClient({ baseUrl: normalized, accessToken });

  const all: RepoRow[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listUserProjects(page, 50);
    if (!batch.length) break;

    for (const p of batch) {
      const segments = p.path_with_namespace.split("/");
      const ownerLogin = segments.slice(0, -1).join("/");
      all.push({
        id: p.id,
        name: p.name,
        full_name: p.path_with_namespace,
        private: p.visibility !== "public",
        owner: { login: ownerLogin },
        html_url: p.web_url,
      });
    }

    if (batch.length < 50) break;
    page += 1;
    if (page > 50) break;
  }

  return { repositories: all };
}

export default listGitlabRepositories;
