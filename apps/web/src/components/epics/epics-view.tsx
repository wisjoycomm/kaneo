import { ChevronRight, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useGetEpics } from "@/hooks/queries/task/use-get-epics";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

export type EpicNode = {
  id: string;
  title: string;
  number: number;
  status: string;
  priority: string;
  type: string;
  parentTaskId: string | null;
  assigneeName: string | null;
  depth: number;
  progress: number;
  doneCount: number;
  totalCount: number;
  children: EpicNode[];
};

type EpicsViewProps = {
  projectId: string;
};

function EpicChildren({ nodes }: { nodes: EpicNode[] }) {
  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <div key={node.id}>
          <div
            className="flex min-h-8 items-center gap-2 border-b border-border/50 px-3 py-1.5 transition-colors hover:bg-accent/60"
            style={{ paddingLeft: `${0.75 + node.depth * 1.5}rem` }}
          >
            <div className="flex-shrink-0">
              {getPriorityIcon(node.priority)}
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              #{node.number}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {node.title}
            </span>
            <Badge variant="secondary" size="sm" className="shrink-0">
              {getStatusLabel(node.status)}
            </Badge>
            {node.assigneeName ? (
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                {node.assigneeName}
              </span>
            ) : null}
          </div>
          {node.children.length > 0 ? (
            <EpicChildren nodes={node.children} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EpicsView({ projectId }: EpicsViewProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetEpics(projectId);
  const epics = (data ?? []) as EpicNode[];
  const { mutate: createTask, isPending } = useCreateTask();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isCreatingEpic, setIsCreatingEpic] = useState(false);
  const [epicTitle, setEpicTitle] = useState("");
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");

  const create = (
    title: string,
    type: "task" | "epic",
    parentTaskId?: string,
  ) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask(
      {
        title: trimmed,
        description: "",
        projectId,
        status: "to-do",
        priority: "no-priority",
        type,
        parentTaskId,
      },
      {
        onSuccess: () => {
          setEpicTitle("");
          setTaskTitle("");
          setIsCreatingEpic(false);
          setAddingTaskFor(null);
        },
        onError: () => {
          toast.error(t("tasks:epics.createError"));
        },
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-card">
      <div className="flex items-center justify-between border-b border-border/80 px-3 py-2 md:px-4">
        <h1 className="text-sm font-semibold text-foreground">
          {t("tasks:epics.title")}
        </h1>
        {isCreatingEpic ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              create(epicTitle, "epic");
            }}
          >
            <Input
              autoFocus
              value={epicTitle}
              onChange={(event) => setEpicTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsCreatingEpic(false);
                  setEpicTitle("");
                }
              }}
              placeholder={t("tasks:epics.epicTitlePlaceholder")}
              className="h-8 w-56 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {t("tasks:epics.create")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreatingEpic(false);
                setEpicTitle("");
              }}
            >
              {t("tasks:epics.cancel")}
            </Button>
          </form>
        ) : (
          <Button size="xs" onClick={() => setIsCreatingEpic(true)}>
            <Plus className="size-3.5" />
            {t("tasks:epics.newEpic")}
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
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-muted-foreground">
            {t("tasks:epics.loadError", {
              defaultValue: "Failed to load epics.",
            })}
          </p>
        </div>
      ) : epics.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-semibold text-foreground">
              {t("tasks:epics.empty")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("tasks:epics.emptySubtitle")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 md:p-4">
          {epics.map((epic) => {
            const isCollapsed = collapsed[epic.id];
            return (
              <div
                key={epic.id}
                className="overflow-hidden rounded-lg border border-border/80 bg-background"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-accent/40">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-accent"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [epic.id]: !prev[epic.id],
                      }))
                    }
                    aria-label={
                      isCollapsed
                        ? t("tasks:epics.expand")
                        : t("tasks:epics.collapse")
                    }
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        !isCollapsed && "rotate-90",
                      )}
                    />
                  </Button>
                  <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    #{epic.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {epic.title}
                  </span>
                  <div className="flex w-44 shrink-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Progress value={epic.progress} className="gap-0">
                        <ProgressTrack className="h-1">
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {Math.round(epic.progress)}%
                      </span>
                    </div>
                    <span className="text-right text-[10px] text-muted-foreground">
                      {t("tasks:epics.progressDone", {
                        defaultValue: "{{done}}/{{total}} done",
                        done: epic.doneCount,
                        total: epic.totalCount,
                      })}
                    </span>
                  </div>
                </div>

                {!isCollapsed ? (
                  <>
                    {epic.children.length > 0 ? (
                      <div className="border-t border-border/60">
                        <EpicChildren nodes={epic.children} />
                      </div>
                    ) : null}
                    <div className="border-t border-border/60 px-3 py-1.5">
                      {addingTaskFor === epic.id ? (
                        <form
                          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 p-1.5"
                          onSubmit={(event) => {
                            event.preventDefault();
                            create(taskTitle, "task", epic.id);
                          }}
                        >
                          <Input
                            autoFocus
                            value={taskTitle}
                            onChange={(event) =>
                              setTaskTitle(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setAddingTaskFor(null);
                                setTaskTitle("");
                              }
                            }}
                            placeholder={t("tasks:epics.taskTitlePlaceholder")}
                            className="h-8 w-56 text-sm [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:leading-8"
                          />
                          <Button type="submit" size="sm" disabled={isPending}>
                            {t("tasks:epics.create")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAddingTaskFor(null);
                              setTaskTitle("");
                            }}
                          >
                            {t("tasks:epics.cancel")}
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                          onClick={() => {
                            setAddingTaskFor(epic.id);
                            setTaskTitle("");
                          }}
                        >
                          <Plus className="size-3.5" />
                          {t("tasks:epics.addTask")}
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
    </div>
  );
}

export default EpicsView;
