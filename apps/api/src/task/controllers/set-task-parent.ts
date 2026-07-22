import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function setTaskParent(
  taskId: string,
  parentTaskId: string | null,
  taskType?: string,
) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });
  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (parentTaskId) {
    if (parentTaskId === taskId) {
      throw new HTTPException(400, {
        message: "Task cannot be its own parent",
      });
    }
    // Walk up from the requested parent to reject cycles.
    let cursor: string | null = parentTaskId;
    while (cursor) {
      const ancestor: typeof task | undefined =
        await db.query.taskTable.findFirst({
          where: eq(taskTable.id, cursor),
        });
      if (!ancestor || ancestor.projectId !== task.projectId) {
        throw new HTTPException(400, {
          message: "Parent task not found in this project",
        });
      }
      if (ancestor.parentTaskId === taskId) {
        throw new HTTPException(400, {
          message: "Cannot create a circular task hierarchy",
        });
      }
      cursor = ancestor.parentTaskId;
    }
  }

  const [updated] = await db
    .update(taskTable)
    .set({
      parentTaskId,
      ...(taskType !== undefined && {
        type: taskType === "epic" ? "epic" : "task",
      }),
    })
    .where(eq(taskTable.id, taskId))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update task parent" });
  }

  return updated;
}

export default setTaskParent;
