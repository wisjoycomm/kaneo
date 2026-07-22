import { and, eq } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable, userTable } from "../../database/schema";

export type EpicTreeNode = {
  id: string;
  title: string;
  number: number | null;
  status: string;
  priority: string | null;
  type: string;
  parentTaskId: string | null;
  assigneeName: string | null;
  depth: number;
  progress: number;
  doneCount: number;
  totalCount: number;
  children: EpicTreeNode[];
};

async function getEpics(projectId: string): Promise<EpicTreeNode[]> {
  const [tasks, finalColumns] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        number: taskTable.number,
        status: taskTable.status,
        priority: taskTable.priority,
        type: taskTable.type,
        parentTaskId: taskTable.parentTaskId,
        assigneeName: userTable.name,
        position: taskTable.position,
      })
      .from(taskTable)
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(eq(taskTable.projectId, projectId)),
    db
      .select({ slug: columnTable.slug })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.isFinal, true),
        ),
      ),
  ]);

  const doneStatuses = new Set(finalColumns.map((c) => c.slug));
  const isDone = (status: string) => doneStatuses.has(status);

  const byParent = new Map<string | null, typeof tasks>();
  for (const task of tasks) {
    const key = task.parentTaskId ?? null;
    const bucket = byParent.get(key);
    if (bucket) {
      bucket.push(task);
    } else {
      byParent.set(key, [task]);
    }
  }

  const taskIds = new Set(tasks.map((t) => t.id));

  function buildNode(
    task: (typeof tasks)[number],
    depth: number,
  ): EpicTreeNode {
    const children = (byParent.get(task.id) ?? [])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((child) => buildNode(child, depth + 1));

    let doneCount = 0;
    let totalCount = 0;
    for (const child of children) {
      doneCount +=
        child.totalCount > 0 ? child.doneCount : isDone(child.status) ? 1 : 0;
      totalCount += child.totalCount > 0 ? child.totalCount : 1;
    }

    return {
      id: task.id,
      title: task.title,
      number: task.number,
      status: task.status,
      priority: task.priority,
      type: task.type,
      parentTaskId: task.parentTaskId,
      assigneeName: task.assigneeName,
      depth,
      doneCount,
      totalCount,
      progress: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
      children,
    };
  }

  // Roots: epics whose parent is absent (top-level or dangling parent id).
  const roots = tasks.filter(
    (task) =>
      task.type === "epic" &&
      (!task.parentTaskId || !taskIds.has(task.parentTaskId)),
  );

  return roots
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .map((task) => buildNode(task, 0));
}

export default getEpics;
