import { useMutation, useQueryClient } from "@tanstack/react-query";
import assignSprintTasks from "@/fetchers/sprint/assign-sprint-tasks";

function useAssignSprintTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      add = [],
      remove = [],
    }: {
      id: string;
      add?: string[];
      remove?: string[];
    }) => assignSprintTasks(id, add, remove),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export default useAssignSprintTasks;
