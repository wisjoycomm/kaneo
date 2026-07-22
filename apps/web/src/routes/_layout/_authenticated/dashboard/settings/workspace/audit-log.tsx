import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useGetAuditLogs from "@/hooks/queries/audit-log/use-get-audit-logs";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";

const PAGE_SIZE = 50;

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/audit-log",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageWorkspace } = useWorkspacePermission();
  const [page, setPage] = useState(0);

  const workspaceId = workspace?.id ?? "";
  const { data, isLoading } = useGetAuditLogs(
    canManageWorkspace() ? workspaceId : "",
    PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!canManageWorkspace()) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollText />
          </EmptyMedia>
          <EmptyTitle>
            {t("settings:workspaceAuditLog.noAccessTitle", {
              defaultValue: "Admins only",
            })}
          </EmptyTitle>
          <EmptyDescription>
            {t("settings:workspaceAuditLog.noAccessDescription", {
              defaultValue: "Only workspace admins can view the audit log.",
            })}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={t("settings:workspaceAuditLog.title", {
          defaultValue: "Audit log",
        })}
      />
      <CardFrame>
        <Card>
          <CardHeader>
            <CardTitle>
              {t("settings:workspaceAuditLog.title", {
                defaultValue: "Audit log",
              })}
            </CardTitle>
            <CardDescription>
              {t("settings:workspaceAuditLog.description", {
                defaultValue: "Who did what and when across this workspace.",
              })}
            </CardDescription>
          </CardHeader>
          <CardPanel>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScrollText />
                  </EmptyMedia>
                  <EmptyTitle>
                    {t("settings:workspaceAuditLog.emptyTitle", {
                      defaultValue: "No entries yet",
                    })}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t("settings:workspaceAuditLog.emptyDescription", {
                      defaultValue:
                        "Changes to projects, columns and tasks will appear here.",
                    })}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/80 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2 font-medium">
                          {t("settings:workspaceAuditLog.columnWhen", {
                            defaultValue: "When",
                          })}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("settings:workspaceAuditLog.columnWho", {
                            defaultValue: "Who",
                          })}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("settings:workspaceAuditLog.columnAction", {
                            defaultValue: "Action",
                          })}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("settings:workspaceAuditLog.columnProject", {
                            defaultValue: "Project",
                          })}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("settings:workspaceAuditLog.columnDetail", {
                            defaultValue: "Detail",
                          })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((entry) => {
                        const [entity, ...rest] = entry.action.split(".");
                        const verb = rest.join(".");
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/40"
                          >
                            <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    {formatRelativeTime(entry.createdAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {formatDateTime(entry.createdAt)}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs font-medium border border-border/30">
                                    {getInitials(
                                      entry.userName ?? entry.userEmail ?? "",
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="truncate text-sm text-foreground">
                                    {entry.userName ?? "—"}
                                  </div>
                                  {entry.userEmail && (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {entry.userEmail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="secondary" size="sm">
                                  {t(
                                    `settings:workspaceAuditLog.entity.${entity}`,
                                    { defaultValue: entity },
                                  )}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {verb
                                    ? t(
                                        `settings:workspaceAuditLog.action.${verb}`,
                                        {
                                          defaultValue: verb.replace(/_/g, " "),
                                        },
                                      )
                                    : ""}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm">
                              {entry.projectName ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-xs text-muted-foreground">
                              {entry.detail
                                ? summarizeDetail(entry.detail)
                                : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TooltipProvider>
            )}
            {total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("settings:workspaceAuditLog.pageOf", {
                    defaultValue: "Page {{page}} of {{pages}}",
                    page: page + 1,
                    pages: pageCount,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    {t("settings:workspaceAuditLog.previous", {
                      defaultValue: "Previous",
                    })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("settings:workspaceAuditLog.next", {
                      defaultValue: "Next",
                    })}
                  </Button>
                </div>
              </div>
            )}
          </CardPanel>
        </Card>
      </CardFrame>
    </div>
  );
}

function summarizeDetail(detail: unknown): string {
  if (typeof detail !== "object" || detail === null) return "";
  return Object.entries(detail as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}
