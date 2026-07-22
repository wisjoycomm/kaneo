import { useQuery } from "@tanstack/react-query";
import getMyTasks from "@/fetchers/task/get-my-tasks";

export function useGetMyTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: () => getMyTasks(workspaceId as string),
    refetchInterval: 30000,
    enabled: !!workspaceId,
  });
}
