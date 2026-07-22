export type ColumnTransitions = Record<string, string[]> | null;

export const DEFAULT_COLUMN_TRANSITIONS: Record<string, string[]> = {
  backlog: ["to-do"],
  "to-do": ["in-progress", "pending", "cancel", "backlog"],
  "in-progress": ["in-review", "backlog"],
  "in-review": ["done", "backlog"],
  done: ["backlog"],
  pending: ["to-do", "backlog"],
  cancel: ["backlog"],
};

export function isTransitionAllowed(
  transitions: ColumnTransitions | undefined,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const allowed = transitions?.[from];
  if (!allowed) return true;
  return allowed.includes(to);
}
