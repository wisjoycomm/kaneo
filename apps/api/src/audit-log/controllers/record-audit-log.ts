import { eq } from "drizzle-orm";
import db from "../../database";
import {
  auditLogTable,
  projectTable,
  userTable,
  workspaceTable,
} from "../../database/schema";

type RecordAuditLogParams = {
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: Record<string, unknown>;
};

async function recordAuditLog(params: RecordAuditLogParams) {
  let { workspaceId, projectName } = params;
  const { projectId, userId, action, entityType, entityId, detail } = params;

  if ((!workspaceId || !projectName) && projectId) {
    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });
    workspaceId = workspaceId ?? project?.workspaceId;
    projectName = projectName ?? project?.name;
  }

  if (!workspaceId) {
    return;
  }

  const workspace = await db.query.workspaceTable.findFirst({
    where: eq(workspaceTable.id, workspaceId),
  });

  const user = userId
    ? await db.query.userTable.findFirst({ where: eq(userTable.id, userId) })
    : undefined;

  await db.insert(auditLogTable).values({
    workspaceId,
    workspaceName: workspace?.name ?? null,
    projectId: projectId ?? null,
    projectName: projectName ?? null,
    userId: userId ?? null,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    action,
    entityType,
    entityId: entityId ?? null,
    detail: detail ?? null,
  });
}

export default recordAuditLog;
