import { useMutation, useQueryClient } from "@tanstack/react-query";
import startSprint from "@/fetchers/sprint/start-sprint";

function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => startSprint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export default useStartSprint;
