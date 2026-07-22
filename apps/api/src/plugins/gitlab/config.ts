import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const gitlabConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryOwner: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryName: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onPROpen: v.optional(v.string()),
      onPRMerge: v.optional(v.string()),
    }),
  ),
});

export type GitlabConfig = v.InferOutput<typeof gitlabConfigSchema>;

export async function validateGitlabConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(gitlabConfigSchema, config);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}

export const defaultGitlabConfig: Partial<GitlabConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitlabIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeGitlabBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function gitlabProjectPath(owner: string, name: string): string {
  return `${owner}/${name}`;
}

export function getDefaultGitlabConfig(
  baseUrl: string,
  accessToken: string,
  repositoryOwner: string,
  repositoryName: string,
  webhookSecret: string,
): GitlabConfig {
  return {
    baseUrl: normalizeGitlabBaseUrl(baseUrl),
    accessToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    ...defaultGitlabConfig,
  };
}
