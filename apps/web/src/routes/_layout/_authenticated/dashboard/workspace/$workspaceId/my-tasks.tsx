import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ListTodo, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useGetMyTasks } from "@/hooks/queries/task/use-get-my-tasks";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: MyTasksComponent,
});

function MyTasksComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useGetMyTasks(workspaceId);

  return (
    <>
      <PageTitle title={t("workspace:myTasks.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:myTasks.pageTitle")}
        headerActions={
          <Link to="/dashboard/workspace/$workspaceId" params={{ workspaceId }}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t("workspace:search.backToDashboard")}
            </Button>
          </Link>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-1">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                    params: { workspaceId, projectId: task.projectId },
                    search: { taskId: task.id },
                  })
                }
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent/60 transition-colors text-left"
              >
                <div className="flex-shrink-0 first:[&_svg]:h-4 first:[&_svg]:w-4">
                  {getPriorityIcon(task.priority ?? "")}
                </div>

                {task.projectSlug && task.number && (
                  <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                    {task.projectSlug}-{task.number}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">
                    {task.title}
                  </span>
                </div>

                {task.projectName && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {task.projectName}
                  </span>
                )}

                <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-muted/55 text-muted-foreground flex-shrink-0">
                  {getStatusLabel(task.status)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {t("workspace:myTasks.emptyTitle")}
            </p>
            <p className="text-muted-foreground">
              {t("workspace:myTasks.emptyDescription")}
            </p>
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}
