import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";

export const DEFAULT_PROJECT_COLUMNS = [
  { name: "Backlog", slug: "backlog", position: 0, isFinal: false },
  { name: "To Do", slug: "to-do", position: 1, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 2, isFinal: false },
  { name: "In Review", slug: "in-review", position: 3, isFinal: false },
  { name: "Done", slug: "done", position: 4, isFinal: true },
  { name: "Pending", slug: "pending", position: 5, isFinal: false },
  { name: "Cancel", slug: "cancel", position: 6, isFinal: true },
] as const;

// Default workflow template: which columns a task may move to from each
// column. UI-level guardrail (see schema.columnTransitions comment).
export const DEFAULT_COLUMN_TRANSITIONS: Record<string, string[]> = {
  backlog: ["to-do"],
  "to-do": ["in-progress", "pending", "cancel", "backlog"],
  "in-progress": ["in-review", "backlog"],
  "in-review": ["done", "backlog"],
  done: ["backlog"],
  pending: ["to-do", "backlog"],
  cancel: ["backlog"],
};

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
) {
  return db.transaction(async (tx) => {
    const [createdProject] = await tx
      .insert(projectTable)
      .values({
        workspaceId,
        name,
        icon,
        slug,
        columnTransitions: DEFAULT_COLUMN_TRANSITIONS,
      })
      .returning();

    if (createdProject) {
      for (const col of DEFAULT_PROJECT_COLUMNS) {
        await tx.insert(columnTable).values({
          projectId: createdProject.id,
          name: col.name,
          slug: col.slug,
          position: col.position,
          isFinal: col.isFinal,
        });
      }
    }

    return createdProject;
  });
}

export default createProject;
