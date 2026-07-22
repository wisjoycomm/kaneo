import { keepPreviousData, useQuery } from "@tanstack/react-query";
import getAuditLogs from "@/fetchers/audit-log/get-audit-logs";

function useGetAuditLogs(workspaceId: string, limit: number, offset: number) {
  return useQuery({
    queryKey: ["audit-logs", workspaceId, limit, offset],
    queryFn: () => getAuditLogs(workspaceId, limit, offset),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export default useGetAuditLogs;
