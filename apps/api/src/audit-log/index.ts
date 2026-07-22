import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { taskTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getAuditLogs from "./controllers/get-audit-logs";
import recordAuditLog from "./controllers/record-audit-log";

const auditLog = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>().get(
  "/:workspaceId",
  describeRoute({
    operationId: "getAuditLogs",
    tags: ["AuditLog"],
    description: "Get the audit log for a workspace, newest first (admin only)",
    responses: {
      200: {
        description: "Paginated audit log entries",
        content: {
          "application/json": { schema: resolver(v.any()) },
        },
      },
    },
  }),
  validator("param", v.object({ workspaceId: v.string() })),
  validator(
    "query",
    v.object({
      limit: v.optional(v.string()),
      offset: v.optional(v.string()),
    }),
  ),
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
  async (c) => {
    const workspaceId = c.get("workspaceId");
    const { limit, offset } = c.req.valid("query");
    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;
    const result = await getAuditLogs(workspaceId, parsedLimit, parsedOffset);
    return c.json(result);
  },
);

async function projectIdFromTask(taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });
  return task?.projectId;
}

subscribeToEvent<{
  taskId: string;
  projectId: string;
  title: string;
  userId: string;
  currentUserId?: string;
}>("task.created", async (data) => {
  await recordAuditLog({
    projectId: data.projectId,
    userId: data.currentUserId || data.userId,
    action: "task.created",
    entityType: "task",
    entityId: data.taskId,
    detail: { title: data.title },
  });
});

subscribeToEvent<{
  taskId: string;
  projectId: string;
  userId: string;
  title: string;
}>("task.deleted", async (data) => {
  await recordAuditLog({
    projectId: data.projectId,
    userId: data.userId,
    action: "task.deleted",
    entityType: "task",
    entityId: data.taskId,
    detail: { title: data.title },
  });
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
}>("task.status_changed", async (data) => {
  await recordAuditLog({
    projectId: await projectIdFromTask(data.taskId),
    userId: data.userId,
    action: "task.status_changed",
    entityType: "task",
    entityId: data.taskId,
    detail: {
      title: data.title,
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
    },
  });
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
}>("task.assignee_changed", async (data) => {
  await recordAuditLog({
    projectId: await projectIdFromTask(data.taskId),
    userId: data.userId,
    action: "task.assignee_changed",
    entityType: "task",
    entityId: data.taskId,
    detail: { title: data.title, newAssignee: data.newAssignee },
  });
});

type ProjectEvent = {
  workspaceId: string;
  userId: string;
  projectId: string;
  projectName: string;
};

for (const action of [
  "project.created",
  "project.updated",
  "project.deleted",
  "project.archived",
  "project.unarchived",
] as const) {
  subscribeToEvent<ProjectEvent>(action, async (data) => {
    await recordAuditLog({
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      projectName: data.projectName,
      userId: data.userId,
      action,
      entityType: "project",
      entityId: data.projectId,
      detail: { name: data.projectName },
    });
  });
}

type ColumnEvent = {
  workspaceId: string;
  userId: string;
  projectId: string;
  columnId?: string;
  columnName?: string;
};

for (const action of [
  "column.created",
  "column.updated",
  "column.deleted",
  "column.reordered",
] as const) {
  subscribeToEvent<ColumnEvent>(action, async (data) => {
    await recordAuditLog({
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      userId: data.userId,
      action,
      entityType: "column",
      entityId: data.columnId,
      detail: data.columnName ? { name: data.columnName } : undefined,
    });
  });
}

export default auditLog;
