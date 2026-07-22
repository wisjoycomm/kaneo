import type { ColumnTransitions } from "@/lib/column-transitions";
import { useGetTasks } from "./use-get-tasks";

export function useColumnTransitions(projectId: string): ColumnTransitions {
  const { data } = useGetTasks(projectId);
  return data?.columnTransitions ?? null;
}
