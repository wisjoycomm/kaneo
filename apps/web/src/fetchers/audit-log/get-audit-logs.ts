import { client } from "@kaneo/libs";

async function getAuditLogs(
  workspaceId: string,
  limit: number,
  offset: number,
) {
  const response = await client["audit-log"][":workspaceId"].$get({
    param: { workspaceId },
    query: { limit: String(limit), offset: String(offset) },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getAuditLogs;
