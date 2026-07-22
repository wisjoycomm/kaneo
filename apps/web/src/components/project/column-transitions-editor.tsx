import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, MoveRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { cn } from "@/lib/cn";
import { DEFAULT_COLUMN_TRANSITIONS } from "@/lib/column-transitions";
import { toast } from "@/lib/toast";

type ColumnTransitionsEditorProps = {
  projectId: string;
};

export default function ColumnTransitionsEditor({
  projectId,
}: ColumnTransitionsEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetTasks(projectId);
  const { mutateAsync: updateProject, isPending } = useUpdateProject();
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(project?.columnTransitions ?? {});
  }, [project?.columnTransitions]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("common:empty.loading", { defaultValue: "Loading..." })}
      </div>
    );
  }

  const columns = project?.columns ?? [];

  if (!project || columns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:projectWorkflowTransitions.noColumns", {
          defaultValue: "Create columns first to configure transitions.",
        })}
      </div>
    );
  }

  const slugs = columns.map((col) => col.id);
  const hasTemplateColumns = Object.keys(DEFAULT_COLUMN_TRANSITIONS).every(
    (slug) => slugs.includes(slug),
  );

  const toggleTarget = (from: string, to: string, checked: boolean) => {
    setDraft((prev) => {
      const current = prev[from] ?? [];
      const next = checked
        ? [...current, to]
        : current.filter((slug) => slug !== to);
      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[from];
      } else {
        updated[from] = next;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await updateProject({
        id: project.id,
        name: project.name,
        icon: project.icon ?? "",
        slug: project.slug,
        description: project.description ?? "",
        isPublic: project.isPublic ?? false,
        columnTransitions: Object.keys(draft).length > 0 ? draft : null,
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success(
        t("settings:projectWorkflowTransitions.toastSaved", {
          defaultValue: "Workflow transitions saved",
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectWorkflowTransitions.toastError", {
              defaultValue: "Failed to save workflow transitions",
            }),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-border">
        {columns.map((column) => {
          const targets = draft[column.id];
          const isOpen = openColumnId === column.id;
          const summary = targets
            ?.map((slug) => columns.find((c) => c.id === slug)?.name ?? slug)
            .join(", ");
          return (
            <div
              key={column.id}
              className="border-b border-border/60 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpenColumnId(isOpen ? null : column.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                  isOpen && "bg-accent/40",
                )}
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                <span className="shrink-0 font-medium">{column.name}</span>
                <MoveRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  {summary ??
                    t("settings:projectWorkflowTransitions.unrestricted", {
                      defaultValue: "Unrestricted",
                    })}
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 bg-sidebar px-3 py-3 pl-9">
                  {columns
                    .filter((target) => target.id !== column.id)
                    .map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={targets?.includes(target.id) ?? false}
                          onCheckedChange={(checked) =>
                            toggleTarget(column.id, target.id, checked === true)
                          }
                          aria-label={target.name}
                        />
                        {target.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("settings:projectWorkflowTransitions.hint", {
          defaultValue:
            "Columns with no targets selected allow moving tasks to any column.",
        })}
      </p>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {t("settings:projectWorkflowTransitions.save", {
            defaultValue: "Save transitions",
          })}
        </Button>
        {hasTemplateColumns && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft({ ...DEFAULT_COLUMN_TRANSITIONS })}
          >
            {t("settings:projectWorkflowTransitions.resetToTemplate", {
              defaultValue: "Reset to template",
            })}
          </Button>
        )}
      </div>
    </div>
  );
}
