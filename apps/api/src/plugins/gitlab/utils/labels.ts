import type { GitlabConfig } from "../config";
import { createGitlabClient, type GitlabLabel } from "./gitlab-api";

const labelColors: Record<string, string> = {
  "priority:low": "0EA5E9",
  "priority:medium": "EAB308",
  "priority:high": "F97316",
  "priority:urgent": "EF4444",
  "status:to-do": "6B7280",
  "status:in-progress": "3B82F6",
  "status:in-review": "8B5CF6",
  "status:done": "10B981",
  "status:planned": "8B5CF6",
  "status:archived": "6B7280",
};

function getLabelColor(labelName: string): string {
  return labelColors[labelName] || "6B7280";
}

export async function ensureLabelsExistGitlab(
  config: GitlabConfig,
  labels: string[],
): Promise<void> {
  const client = createGitlabClient(config);
  const { repositoryOwner, repositoryName } = config;

  let existingLabels: GitlabLabel[];
  try {
    existingLabels = await client.listLabels(repositoryOwner, repositoryName);
  } catch (error) {
    console.error("Failed to list GitLab labels for ensureLabelsExistGitlab", {
      repositoryOwner,
      repositoryName,
      error,
    });
    return;
  }

  const existingNames = new Set(existingLabels.map((l) => l.name));

  for (const name of labels) {
    if (existingNames.has(name)) continue;
    try {
      await client.createLabel(
        repositoryOwner,
        repositoryName,
        name,
        getLabelColor(name),
      );
    } catch (error) {
      console.error(`Failed to ensure GitLab label "${name}":`, error);
    }
  }
}

export async function addLabelsToIssueGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelNames: string[],
) {
  if (labelNames.length === 0) return;

  await ensureLabelsExistGitlab(config, labelNames);

  const client = createGitlabClient(config);
  try {
    await client.addLabelsToIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueIid,
      labelNames,
    );
  } catch (error) {
    console.error("Failed to add labels to GitLab issue:", error);
  }
}

export async function removeLabelGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelName: string,
) {
  const client = createGitlabClient(config);
  try {
    await client.removeLabelFromIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueIid,
      labelName,
    );
  } catch (error) {
    console.error("Failed to remove label from GitLab issue:", {
      repositoryOwner: config.repositoryOwner,
      repositoryName: config.repositoryName,
      issueIid,
      labelName,
      error,
    });
  }
}
