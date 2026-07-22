import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTask from "@/fetchers/task/update-task";
import type Task from "@/types/task";

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["update-task"],
    mutationFn: (task: Task) => updateTask(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      // Board drops fan out one update per repositioned task; refetching the
      // whole board per task makes dropped cards flicker through stale
      // orderings. Only the last in-flight update refetches the board.
      if (queryClient.isMutating({ mutationKey: ["update-task"] }) <= 1) {
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
    },
  });
}
