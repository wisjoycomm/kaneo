import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteSprint from "@/fetchers/sprint/delete-sprint";

function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSprint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export default useDeleteSprint;
