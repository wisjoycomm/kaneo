import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, sprintTable, taskTable } from "../../database/schema";

// ponytail: thin CRUD ops kept in one file instead of six controller files —
// split when any of them grows real logic.

export async function listSprints(projectId: string) {
  return db.query.sprintTable.findMany({
    where: and(
      eq(sprintTable.projectId, projectId),
      isNull(sprintTable.deletedAt),
    ),
    orderBy: (sprint, { desc }) => [desc(sprint.createdAt)],
  });
}

export async function createSprint(params: {
  projectId: string;
  name: string;
  goal?: string;
  duration?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const [created] = await db
    .insert(sprintTable)
    .values({
      projectId: params.projectId,
      name: params.name,
      goal: params.goal ?? null,
      duration: params.duration ?? "custom",
      startDate: params.startDate ?? null,
      endDate: params.endDate ?? null,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create sprint" });
  }
  return created;
}

async function getActiveSprint(id: string) {
  const sprint = await db.query.sprintTable.findFirst({
    where: and(eq(sprintTable.id, id), isNull(sprintTable.deletedAt)),
  });
  if (!sprint) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }
  return sprint;
}

export async function updateSprint(
  id: string,
  data: {
    name?: string;
    goal?: string | null;
    duration?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  },
) {
  await getActiveSprint(id);
  const [updated] = await db
    .update(sprintTable)
    .set(data)
    .where(eq(sprintTable.id, id))
    .returning();
  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update sprint" });
  }
  return updated;
}

export async function startSprint(id: string) {
  const sprint = await getActiveSprint(id);
  if (sprint.status !== "planned") {
    throw new HTTPException(409, {
      message: `Cannot start a sprint in status "${sprint.status}"`,
    });
  }

  const conflicting = await db.query.sprintTable.findFirst({
    where: and(
      eq(sprintTable.projectId, sprint.projectId),
      eq(sprintTable.status, "active"),
      isNull(sprintTable.deletedAt),
    ),
  });
  if (conflicting) {
    throw new HTTPException(409, {
      message: "Another sprint is already active in this project",
    });
  }

  const [updated] = await db
    .update(sprintTable)
    .set({ status: "active", startDate: sprint.startDate ?? new Date() })
    .where(eq(sprintTable.id, id))
    .returning();
  return updated;
}

export async function completeSprint(id: string) {
  const sprint = await getActiveSprint(id);
  if (sprint.status !== "active") {
    throw new HTTPException(409, {
      message: `Cannot complete a sprint in status "${sprint.status}"`,
    });
  }

  // Unfinished tasks (not in a final column) drop back out of the sprint.
  const finalColumns = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, sprint.projectId),
        eq(columnTable.isFinal, true),
      ),
    );
  const doneStatuses = finalColumns.map((c) => c.slug);

  const sprintTasks = await db.query.taskTable.findMany({
    where: eq(taskTable.sprintId, id),
  });
  const unfinishedIds = sprintTasks
    .filter((t) => !doneStatuses.includes(t.status))
    .map((t) => t.id);

  if (unfinishedIds.length > 0) {
    await db
      .update(taskTable)
      .set({ sprintId: null })
      .where(inArray(taskTable.id, unfinishedIds));
  }

  const [updated] = await db
    .update(sprintTable)
    .set({ status: "completed", endDate: new Date() })
    .where(eq(sprintTable.id, id))
    .returning();
  return { sprint: updated, unfinishedTaskIds: unfinishedIds };
}

export async function deleteSprint(id: string) {
  const sprint = await getActiveSprint(id);
  await db
    .update(taskTable)
    .set({ sprintId: null })
    .where(eq(taskTable.sprintId, id));
  const [deleted] = await db
    .update(sprintTable)
    .set({ deletedAt: new Date() })
    .where(eq(sprintTable.id, sprint.id))
    .returning();
  return deleted;
}

export async function assignTasksToSprint(
  id: string,
  add: string[],
  remove: string[],
) {
  const sprint = await getActiveSprint(id);

  if (add.length > 0) {
    await db
      .update(taskTable)
      .set({ sprintId: sprint.id })
      .where(
        and(
          inArray(taskTable.id, add),
          eq(taskTable.projectId, sprint.projectId),
        ),
      );
  }
  if (remove.length > 0) {
    await db
      .update(taskTable)
      .set({ sprintId: null })
      .where(and(inArray(taskTable.id, remove), eq(taskTable.sprintId, id)));
  }

  return db.query.taskTable.findMany({
    where: eq(taskTable.sprintId, id),
  });
}
