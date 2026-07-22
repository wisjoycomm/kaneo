import { useMutation, useQueryClient } from "@tanstack/react-query";
import completeSprint from "@/fetchers/sprint/complete-sprint";

function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeSprint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export default useCompleteSprint;
