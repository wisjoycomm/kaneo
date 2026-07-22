import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSprint from "@/fetchers/sprint/create-sprint";

function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      ...data
    }: {
      projectId: string;
      name: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
    }) => createSprint(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export default useCreateSprint;
