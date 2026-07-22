import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import EpicsView from "@/components/epics/epics-view";
import PageTitle from "@/components/page-title";
import useGetProject from "@/hooks/queries/project/use-get-project";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/epics",
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
      activeView="epics"
    >
      <PageTitle
        title={t("tasks:epics.pageTitle", { name: project?.name })}
        hideAppName
      />
      <EpicsView projectId={projectId} />
    </ProjectLayout>
  );
}
