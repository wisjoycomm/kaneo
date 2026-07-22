import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskParent from "@/fetchers/task/set-task-parent";

function useSetTaskParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      parentTaskId,
      type,
    }: {
      id: string;
      parentTaskId: string | null;
      type?: "task" | "epic";
    }) => setTaskParent(id, parentTaskId, type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["epics"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task"] });
    },
  });
}

export default useSetTaskParent;
