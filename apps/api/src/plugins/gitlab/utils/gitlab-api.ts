import type { GitlabConfig } from "../config";
import { gitlabProjectPath, normalizeGitlabBaseUrl } from "../config";

export type GitlabLabel = {
  id: number;
  name: string;
  color?: string;
};

export type GitlabIssue = {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  labels?: string[];
  author?: { username?: string; avatar_url?: string } | null;
};

export type GitlabNote = {
  id: number;
  body: string;
  author?: { username?: string; avatar_url?: string } | null;
  created_at: string;
};

export type GitlabMergeRequest = {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  source_branch: string;
  author?: { username?: string; avatar_url?: string } | null;
  merged_at?: string | null;
};

export class GitlabApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "GitlabApiError";
  }
}

const GITLAB_FETCH_TIMEOUT_MS = 10_000;

export async function gitlabFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const root = normalizeGitlabBaseUrl(baseUrl);
  const url = `${root}/api/v4${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GITLAB_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const text = await res.text();
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new GitlabApiError(
        `GitLab API error ${res.status}`,
        res.status,
        text,
      );
    }

    if (res.status === 204 || text === "") {
      return undefined;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GitlabApiError(
        "GitLab API returned invalid JSON",
        res.status,
        text,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof GitlabApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new GitlabApiError(
          `GitLab request timed out after ${GITLAB_FETCH_TIMEOUT_MS}ms`,
          408,
        );
      }
      throw error;
    }
    throw error;
  }
}

export function createGitlabClient(
  config: Pick<GitlabConfig, "baseUrl" | "accessToken">,
) {
  const { baseUrl, accessToken } = config;
  const projectId = (owner: string, name: string) =>
    encodeURIComponent(gitlabProjectPath(owner, name));

  return {
    async getProject(
      repositoryOwner: string,
      repositoryName: string,
    ): Promise<{
      id: number;
      name: string;
      path_with_namespace: string;
      web_url: string;
      visibility: string;
      permissions?: {
        project_access?: { access_level: number } | null;
        group_access?: { access_level: number } | null;
      };
    }> {
      const project = await gitlabFetch<{
        id: number;
        name: string;
        path_with_namespace: string;
        web_url: string;
        visibility: string;
        permissions?: {
          project_access?: { access_level: number } | null;
          group_access?: { access_level: number } | null;
        };
      }>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}`,
      );
      if (!project) {
        throw new GitlabApiError("GitLab project response was empty", 500);
      }
      return project;
    },

    async listUserProjects(
      page = 1,
      perPage = 50,
    ): Promise<
      Array<{
        id: number;
        name: string;
        path_with_namespace: string;
        web_url: string;
        visibility: string;
      }>
    > {
      const projects = await gitlabFetch<
        Array<{
          id: number;
          name: string;
          path_with_namespace: string;
          web_url: string;
          visibility: string;
        }>
      >(
        baseUrl,
        accessToken,
        `/projects?membership=true&page=${page}&per_page=${perPage}`,
      );
      if (!projects) {
        throw new GitlabApiError("GitLab projects response was empty", 500);
      }
      return projects;
    },

    async createIssue(
      repositoryOwner: string,
      repositoryName: string,
      body: { title: string; description?: string | null },
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!issue) {
        throw new GitlabApiError("GitLab create issue response was empty", 500);
      }
      return issue;
    },

    async updateIssue(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
      body: Record<string, unknown>,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}`,
        { method: "PUT", body: JSON.stringify(body) },
      );
      if (!issue) {
        throw new GitlabApiError("GitLab update issue response was empty", 500);
      }
      return issue;
    },

    async listIssueNotes(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
      page: number,
      perPage: number,
    ): Promise<GitlabNote[]> {
      const notes = await gitlabFetch<GitlabNote[]>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}/notes?page=${page}&per_page=${perPage}`,
      );
      if (!notes) {
        throw new GitlabApiError("GitLab notes response was empty", 500);
      }
      return notes;
    },

    async createIssueNote(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
      body: string,
    ): Promise<GitlabNote> {
      const note = await gitlabFetch<GitlabNote>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}/notes`,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      if (!note) {
        throw new GitlabApiError("GitLab create note response was empty", 500);
      }
      return note;
    },

    async listLabels(
      repositoryOwner: string,
      repositoryName: string,
    ): Promise<GitlabLabel[]> {
      const labels = await gitlabFetch<GitlabLabel[]>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/labels`,
      );
      if (!labels) {
        throw new GitlabApiError("GitLab labels response was empty", 500);
      }
      return labels;
    },

    async createLabel(
      repositoryOwner: string,
      repositoryName: string,
      name: string,
      color: string,
    ): Promise<GitlabLabel> {
      const label = await gitlabFetch<GitlabLabel>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            color: color.startsWith("#") ? color : `#${color}`,
          }),
        },
      );
      if (!label) {
        throw new GitlabApiError("GitLab create label response was empty", 500);
      }
      return label;
    },

    async addLabelsToIssue(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
      labelNames: string[],
    ) {
      if (labelNames.length === 0) return;
      await gitlabFetch<unknown>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}`,
        {
          method: "PUT",
          body: JSON.stringify({ add_labels: labelNames.join(",") }),
        },
      );
    },

    async removeLabelFromIssue(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
      labelName: string,
    ) {
      await gitlabFetch<unknown>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}`,
        {
          method: "PUT",
          body: JSON.stringify({ remove_labels: labelName }),
        },
      );
    },

    async getIssue(
      repositoryOwner: string,
      repositoryName: string,
      iid: number,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues/${iid}`,
      );
      if (!issue) {
        throw new GitlabApiError("GitLab issue response was empty", 500);
      }
      return issue;
    },

    async listIssues(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
      state: "opened" | "closed" | "all",
    ): Promise<GitlabIssue[]> {
      const issues = await gitlabFetch<GitlabIssue[]>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/issues?state=${state}&page=${page}&per_page=100`,
      );
      if (!issues) {
        throw new GitlabApiError("GitLab issues response was empty", 500);
      }
      return issues;
    },

    async listMergeRequests(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
    ): Promise<GitlabMergeRequest[]> {
      const mrs = await gitlabFetch<GitlabMergeRequest[]>(
        baseUrl,
        accessToken,
        `/projects/${projectId(repositoryOwner, repositoryName)}/merge_requests?state=opened&page=${page}&per_page=100`,
      );
      if (!mrs) {
        throw new GitlabApiError(
          "GitLab merge requests response was empty",
          500,
        );
      }
      return mrs;
    },
  };
}

export async function verifyGitlabToken(baseUrl: string, token: string) {
  const user = await gitlabFetch<{ id: number; username: string }>(
    normalizeGitlabBaseUrl(baseUrl),
    token,
    "/user",
  );
  if (!user) {
    throw new GitlabApiError("GitLab user response was empty", 500);
  }
  return user;
}
