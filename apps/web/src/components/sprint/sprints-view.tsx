import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useAssignSprintTasks from "@/hooks/mutations/sprint/use-assign-sprint-tasks";
import useCompleteSprint from "@/hooks/mutations/sprint/use-complete-sprint";
import useCreateSprint from "@/hooks/mutations/sprint/use-create-sprint";
import useDeleteSprint from "@/hooks/mutations/sprint/use-delete-sprint";
import useStartSprint from "@/hooks/mutations/sprint/use-start-sprint";
import useUpdateSprint from "@/hooks/mutations/sprint/use-update-sprint";
import { useGetSprintTasks } from "@/hooks/queries/sprint/use-get-sprint-tasks";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

type SprintsViewProps = {
  projectId: string;
};

type SprintStatus = "planned" | "active" | "completed";

const statusOrder: Record<string, number> = {
  active: 0,
  planned: 1,
  completed: 2,
};

const statusVariant: Record<SprintStatus, "success" | "secondary" | "info"> = {
  active: "success",
  planned: "secondary",
  completed: "info",
};

function formatDate(value: string | null) {
  return value ? formatDateShort(value) : null;
}

function SprintsView({ projectId }: SprintsViewProps) {
  const { t } = useTranslation();
  const { data: sprintsData, isLoading, isError } = useGetSprints(projectId);
  const sprints = useMemo(() => sprintsData ?? [], [sprintsData]);
  const sprintIds = useMemo(() => sprints.map((s) => s.id), [sprints]);
  const { data: sprintTaskMap = {} } = useGetSprintTasks(projectId, sprintIds);
  const { data: project } = useGetTasks(projectId);

  const allTasks = useMemo(() => {
    if (!project) return [];
    return [
      ...(project.columns ?? []).flatMap((column) => column.tasks),
      ...(project.plannedTasks ?? []),
      ...(project.archivedTasks ?? []),
    ];
  }, [project]);

  const assignedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tasks of Object.values(sprintTaskMap)) {
      for (const task of tasks) {
        ids.add(task.id);
      }
    }
    return ids;
  }, [sprintTaskMap]);

  const unassignedTasks = useMemo(
    () => allTasks.filter((task) => !assignedTaskIds.has(task.id)),
    [allTasks, assignedTaskIds],
  );

  const sortedSprints = useMemo(
    () =>
      [...sprints].sort(
        (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3),
      ),
    [sprints],
  );

  const { mutate: createSprint, isPending: isCreating } = useCreateSprint();
  const { mutate: updateSprint, isPending: isUpdating } = useUpdateSprint();
  const { mutate: startSprint } = useStartSprint();
  const { mutate: completeSprint } = useCompleteSprint();
  const { mutate: deleteSprint, isPending: isDeleting } = useDeleteSprint();
  const { mutate: assignTasks } = useAssignSprintTasks();

  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingTasksFor, setAddingTasksFor] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", goal: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredUnassignedTasks = useMemo(() => {
    const query = taskFilter.trim().toLowerCase();
    if (!query) return unassignedTasks;
    return unassignedTasks.filter((task) =>
      task.title.toLowerCase().includes(query),
    );
  }, [unassignedTasks, taskFilter]);

  const resetForm = () =>
    setForm({ name: "", goal: "", startDate: "", endDate: "" });

  const handleCreate = () => {
    const name = form.name.trim();
    if (!name) return;
    createSprint(
      {
        projectId,
        name,
        goal: form.goal.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          setIsCreatingSprint(false);
        },
        onError: () =>
          toast.error(
            t("tasks:sprints.createError", {
              defaultValue: "Failed to create sprint",
            }),
          ),
      },
    );
  };

  const handleSaveEdit = (id: string) => {
    const name = editForm.name.trim();
    if (!name) return;
    updateSprint(
      { id, name, goal: editForm.goal.trim() || undefined },
      {
        onSuccess: () => setEditingId(null),
        onError: () =>
          toast.error(
            t("tasks:sprints.updateError", {
              defaultValue: "Failed to update sprint",
            }),
          ),
      },
    );
  };

  const handleStart = (id: string) => {
    startSprint(id, {
      onError: (error) => toast.error(error.message),
    });
  };

  const handleComplete = (id: string) => {
    completeSprint(id, {
      onSuccess: (result) => {
        toast.success(
          t("tasks:sprints.completeSuccess", {
            count: result.unfinishedTaskIds.length,
            defaultValue:
              "Sprint completed. {{count}} unfinished task(s) released back to the backlog.",
          }),
        );
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteSprint(deletingId, {
      onSuccess: () => {
        setDeletingId(null);
        toast.success(
          t("tasks:sprints.deleteSuccess", {
            defaultValue: "Sprint deleted",
          }),
        );
      },
      onError: () =>
        toast.error(
          t("tasks:sprints.deleteError", {
            defaultValue: "Failed to delete sprint",
          }),
        ),
    });
  };

  const handleAssign = (
    sprintId: string,
    add?: string[],
    remove?: string[],
  ) => {
    assignTasks(
      { id: sprintId, add, remove },
      {
        onError: () =>
          toast.error(
            t("tasks:sprints.assignError", {
              defaultValue: "Failed to update sprint tasks",
            }),
          ),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-2 md:px-4">
        <h1 className="text-sm font-semibold text-foreground">
          {t("tasks:sprints.title", { defaultValue: "Sprints" })}
        </h1>
        {isCreatingSprint ? (
          <form
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
          >
            <Input
              autoFocus
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsCreatingSprint(false);
                  resetForm();
                }
              }}
              placeholder={t("tasks:sprints.namePlaceholder", {
                defaultValue: "Sprint name",
              })}
              className="h-8 w-40 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
            />
            <Input
              value={form.goal}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, goal: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsCreatingSprint(false);
                  resetForm();
                }
              }}
              placeholder={t("tasks:sprints.goalPlaceholder", {
                defaultValue: "Goal (optional)",
              })}
              className="h-8 w-44 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
            />
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
              aria-label={t("tasks:sprints.startDate", {
                defaultValue: "Start date",
              })}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground shadow-xs/5"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, endDate: event.target.value }))
              }
              aria-label={t("tasks:sprints.endDate", {
                defaultValue: "End date",
              })}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground shadow-xs/5"
            />
            <Button type="submit" size="sm" disabled={isCreating}>
              {t("tasks:sprints.create", { defaultValue: "Create" })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreatingSprint(false);
                resetForm();
              }}
            >
              {t("tasks:sprints.cancel", { defaultValue: "Cancel" })}
            </Button>
          </form>
        ) : (
          <Button size="xs" onClick={() => setIsCreatingSprint(true)}>
            <Plus className="size-3.5" />
            {t("tasks:sprints.newSprint", { defaultValue: "New sprint" })}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 p-3 md:p-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-border/80 bg-background"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Skeleton className="size-6" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
                <div className="flex-1" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-muted-foreground">
            {t("tasks:sprints.loadError", {
              defaultValue: "Failed to load sprints.",
            })}
          </p>
        </div>
      ) : sortedSprints.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-semibold text-foreground">
              {t("tasks:sprints.empty", { defaultValue: "No sprints yet" })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("tasks:sprints.emptySubtitle", {
                defaultValue:
                  "Create a sprint to plan a focused batch of work from your backlog.",
              })}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 md:p-4">
          {sortedSprints.map((sprint) => {
            const isExpanded = expanded[sprint.id];
            const tasks = sprintTaskMap[sprint.id] ?? [];
            const isEditing = editingId === sprint.id;
            const start = formatDate(sprint.startDate);
            const end = formatDate(sprint.endDate);

            return (
              <div
                key={sprint.id}
                className="overflow-hidden rounded-lg border border-border/80 bg-background"
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 transition-colors hover:bg-accent/40">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-accent"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [sprint.id]: !prev[sprint.id],
                      }))
                    }
                    aria-label={
                      isExpanded
                        ? t("tasks:sprints.collapse", {
                            defaultValue: "Collapse sprint",
                          })
                        : t("tasks:sprints.expand", {
                            defaultValue: "Expand sprint",
                          })
                    }
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </Button>

                  {isEditing ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSaveEdit(sprint.id);
                      }}
                    >
                      <Input
                        autoFocus
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        placeholder={t("tasks:sprints.namePlaceholder", {
                          defaultValue: "Sprint name",
                        })}
                        className="h-8 w-40 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
                      />
                      <Input
                        value={editForm.goal}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            goal: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        placeholder={t("tasks:sprints.goalPlaceholder", {
                          defaultValue: "Goal (optional)",
                        })}
                        className="h-8 w-44 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
                      />
                      <Button type="submit" size="sm" disabled={isUpdating}>
                        {t("tasks:sprints.save", { defaultValue: "Save" })}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        {t("tasks:sprints.cancel", { defaultValue: "Cancel" })}
                      </Button>
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                          {sprint.name}
                        </span>
                        <Badge
                          variant={
                            statusVariant[sprint.status as SprintStatus] ??
                            "secondary"
                          }
                          size="sm"
                          className="shrink-0"
                        >
                          {t(`tasks:sprints.status.${sprint.status}`, {
                            defaultValue: sprint.status,
                          })}
                        </Badge>
                      </div>
                      {(sprint.goal || start || end) && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {[
                            sprint.goal,
                            [start, end].filter(Boolean).join(" – "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      {sprint.status === "planned" && (
                        <Button
                          size="xs"
                          onClick={() => handleStart(sprint.id)}
                        >
                          {t("tasks:sprints.start", { defaultValue: "Start" })}
                        </Button>
                      )}
                      {sprint.status === "active" && (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => handleComplete(sprint.id)}
                        >
                          {t("tasks:sprints.complete", {
                            defaultValue: "Complete",
                          })}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("tasks:sprints.actions", {
                              defaultValue: "Sprint actions",
                            })}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(sprint.id);
                              setEditForm({
                                name: sprint.name,
                                goal: sprint.goal ?? "",
                              });
                            }}
                          >
                            <Pencil className="size-3.5" />
                            {t("tasks:sprints.edit", {
                              defaultValue: "Edit sprint",
                            })}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeletingId(sprint.id)}
                          >
                            <Trash2 className="size-3.5" />
                            {t("tasks:sprints.delete", {
                              defaultValue: "Delete",
                            })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {isExpanded ? (
                  <>
                    <div className="border-t border-border/60">
                      {tasks.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {t("tasks:sprints.noTasks", {
                            defaultValue: "No tasks in this sprint yet.",
                          })}
                        </p>
                      ) : (
                        <TooltipProvider>
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex min-h-8 items-center gap-2 border-b border-border/50 px-3 py-1.5 transition-colors last:border-b-0 hover:bg-accent/60"
                            >
                              <div className="flex-shrink-0">
                                {getPriorityIcon(task.priority ?? "")}
                              </div>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                #{task.number}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                {task.title}
                              </span>
                              <Badge
                                variant="secondary"
                                size="sm"
                                className="shrink-0"
                              >
                                {getStatusLabel(task.status)}
                              </Badge>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label={t("tasks:sprints.removeTask", {
                                      defaultValue: "Remove from sprint",
                                    })}
                                    onClick={() =>
                                      handleAssign(sprint.id, undefined, [
                                        task.id,
                                      ])
                                    }
                                  >
                                    <X className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t("tasks:sprints.removeTask", {
                                    defaultValue: "Remove from sprint",
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ))}
                        </TooltipProvider>
                      )}
                    </div>

                    <div className="border-t border-border/60 px-3 py-1.5">
                      {addingTasksFor === sprint.id ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t("tasks:sprints.unassignedTasks", {
                                defaultValue: "Tasks not in a sprint",
                              })}
                            </p>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setAddingTasksFor(null);
                                setTaskFilter("");
                              }}
                            >
                              {t("tasks:sprints.cancel", {
                                defaultValue: "Cancel",
                              })}
                            </Button>
                          </div>
                          {unassignedTasks.length === 0 ? (
                            <p className="pb-1 text-xs text-muted-foreground">
                              {t("tasks:sprints.noUnassignedTasks", {
                                defaultValue:
                                  "All project tasks are already in a sprint.",
                              })}
                            </p>
                          ) : (
                            <>
                              <Input
                                autoFocus
                                type="search"
                                value={taskFilter}
                                onChange={(event) =>
                                  setTaskFilter(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    setAddingTasksFor(null);
                                    setTaskFilter("");
                                  }
                                }}
                                placeholder={t(
                                  "tasks:sprints.filterTasksPlaceholder",
                                  { defaultValue: "Filter tasks..." },
                                )}
                                className="h-8 max-w-64 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
                              />
                              <div className="max-h-56 overflow-y-auto">
                                {filteredUnassignedTasks.length === 0 ? (
                                  <p className="px-1 py-1.5 text-xs text-muted-foreground">
                                    {t("tasks:sprints.noMatchingTasks", {
                                      defaultValue:
                                        "No tasks match your search.",
                                    })}
                                  </p>
                                ) : (
                                  filteredUnassignedTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className="flex min-h-8 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent/60"
                                    >
                                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                        #{task.number}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                        {task.title}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={t("tasks:sprints.addTask", {
                                          defaultValue: "Add to sprint",
                                        })}
                                        onClick={() =>
                                          handleAssign(sprint.id, [task.id])
                                        }
                                      >
                                        <Plus className="size-3" />
                                      </Button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                          onClick={() => {
                            setAddingTasksFor(sprint.id);
                            setTaskFilter("");
                          }}
                        >
                          <Plus className="size-3.5" />
                          {t("tasks:sprints.addTasks", {
                            defaultValue: "Add tasks",
                          })}
                        </Button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tasks:sprints.deleteConfirmTitle", {
                defaultValue: "Delete this sprint?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:sprints.deleteConfirmDescription", {
                defaultValue:
                  "Tasks in this sprint will be released back to the backlog. This action cannot be undone.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t("tasks:sprints.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {t("tasks:sprints.delete", { defaultValue: "Delete" })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SprintsView;
