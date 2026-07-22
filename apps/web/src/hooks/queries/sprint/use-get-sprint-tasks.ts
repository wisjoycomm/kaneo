import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export type SprintTask = {
  id: string;
  title: string;
  number: number | null;
  status: string;
  priority?: string | null;
  sprintId: string | null;
};

export function useGetSprintTasks(
  projectId: string | undefined,
  sprintIds: string[],
) {
  return useQuery({
    queryKey: ["sprint-tasks", projectId, sprintIds],
    queryFn: async () => {
      const data = await getTasks(projectId ?? "");
      const allTasks: SprintTask[] = [
        ...data.columns.flatMap((column) => column.tasks),
        ...data.archivedTasks,
        ...data.plannedTasks,
      ];
      const bySprint: Record<string, SprintTask[]> = {};
      for (const id of sprintIds) {
        bySprint[id] = allTasks.filter((task) => task.sprintId === id);
      }
      return bySprint;
    },
    enabled: !!projectId,
  });
}
