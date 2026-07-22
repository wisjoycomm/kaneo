import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import SprintsView from "@/components/sprint/sprints-view";
import useGetProject from "@/hooks/queries/project/use-get-project";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/sprints",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="sprints"
    >
      <PageTitle
        title={t("tasks:sprints.pageTitle", {
          name: project?.name,
          defaultValue: "{{name}} — Sprints",
        })}
        hideAppName
      />
      <SprintsView projectId={projectId} />
    </ProjectLayout>
  );
}
