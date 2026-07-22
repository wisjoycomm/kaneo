import { useQuery } from "@tanstack/react-query";
import getEpics from "@/fetchers/task/get-epics";

export function useGetEpics(projectId: string | undefined) {
  return useQuery({
    queryKey: ["epics", projectId],
    queryFn: () => getEpics(projectId as string),
    enabled: !!projectId,
  });
}
