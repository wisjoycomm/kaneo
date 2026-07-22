import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateSprint from "@/fetchers/sprint/update-sprint";

function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
    }) => updateSprint(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export default useUpdateSprint;
