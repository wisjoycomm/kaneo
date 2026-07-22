import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";

type GetMyTasksOptions = {
  status?: string;
  priority?: string;
  sortBy?: "createdAt" | "priority" | "dueDate" | "title" | "number";
  sortOrder?: "asc" | "desc";
};

const priorityCaseExpr = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

function buildOrderBy(
  sortBy: GetMyTasksOptions["sortBy"],
  sortOrder: GetMyTasksOptions["sortOrder"],
): SQL {
  const direction = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "priority":
      return direction(priorityCaseExpr);
    case "dueDate":
      return direction(taskTable.dueDate);
    case "title":
      return direction(taskTable.title);
    case "number":
      return direction(taskTable.number);
    default:
      return direction(taskTable.createdAt);
  }
}

async function getMyTasks(
  workspaceId: string,
  userId: string,
  options: GetMyTasksOptions = {},
) {
  const conditions = [
    eq(projectTable.workspaceId, workspaceId),
    eq(taskTable.userId, userId),
  ];

  if (options.status) {
    conditions.push(eq(taskTable.status, options.status));
  }

  if (options.priority) {
    conditions.push(eq(taskTable.priority, options.priority));
  }

  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      assigneeImage: userTable.image,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(and(...conditions))
    .orderBy(
      buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc"),
    );

  return tasks;
}

export default getMyTasks;
