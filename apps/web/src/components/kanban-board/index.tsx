import type { Modifier } from "@dnd-kit/core";
import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { useEffect, useRef, useState } from "react";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { isTransitionAllowed } from "@/lib/column-transitions";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import Column from "./column";
import DropChipBar, { DROP_CHIP_PREFIX } from "./drop-chip-bar";
import TaskCard from "./task-card";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

// Anchor the dragged card's TOP CENTER to the cursor (like holding a card by
// its top edge) instead of dnd-kit's default grab-point offset.
const snapTopCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent);
    if (!activatorCoordinates) {
      return transform;
    }
    const offsetX = activatorCoordinates.x - draggingNodeRect.left;
    const offsetY = activatorCoordinates.y - draggingNodeRect.top;
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2,
      y: transform.y + offsetY + 8,
    };
  }
  return transform;
};

function KanbanBoard({ project, disableDragDrop = false }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { setProject } = useProjectStore();
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
    selectedTaskIds,
  } = useBulkSelectionStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { mutate: updateTask } = useUpdateTask();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const edgeScrollDirection = useRef(0);
  const edgeScrollFrame = useRef<number | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());

  const scrollToColumn = (columnId: string) => {
    columnRefs.current.get(columnId)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  // Hover near the board's left/right edge scrolls it — no drag required,
  // and during a drag it doubles as the way to reach far-off columns.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-bind when the scroll container mounts after the loading skeleton
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const EDGE = 72;
    const SPEED = 14;

    const step = () => {
      if (edgeScrollDirection.current !== 0) {
        container.scrollLeft += edgeScrollDirection.current * SPEED;
        edgeScrollFrame.current = requestAnimationFrame(step);
      } else {
        edgeScrollFrame.current = null;
      }
    };

    // Window-level so the zones still catch the pointer when it sits at the
    // very window edge (over the sidebar or past the container's border).
    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const inVerticalBounds =
        event.clientY >= rect.top && event.clientY <= rect.bottom;

      let direction = 0;
      if (inVerticalBounds) {
        if (event.clientX <= rect.left + EDGE) direction = -1;
        else if (event.clientX >= rect.right - EDGE) direction = 1;
      }

      edgeScrollDirection.current = direction;
      if (direction !== 0 && edgeScrollFrame.current === null) {
        edgeScrollFrame.current = requestAnimationFrame(step);
      }
    };

    // Once the pointer leaves the window no mousemove fires to reset the
    // direction — the loop would scroll forever. Stop on leave/blur.
    const stopScrolling = () => {
      edgeScrollDirection.current = 0;
    };

    window.addEventListener("mousemove", onMouseMove);
    document.documentElement.addEventListener("mouseleave", stopScrolling);
    window.addEventListener("blur", stopScrolling);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", stopScrolling);
      window.removeEventListener("blur", stopScrolling);
      if (edgeScrollFrame.current !== null) {
        cancelAnimationFrame(edgeScrollFrame.current);
        edgeScrollFrame.current = null;
      }
      edgeScrollDirection.current = 0;
    };
  }, [Boolean(project?.columns)]);

  useEffect(() => {
    if (project?.columns) {
      const allTaskIds = project.columns.flatMap((column) =>
        column.tasks.map((task) => task.id),
      );
      setAvailableTasks(allTaskIds);
    }
  }, [project, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      Enter: () => {
        if (focusedTaskId && project) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              taskId: focusedTaskId,
            },
          });
        }
      },
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor),
  );

  // Pointer-first hit-testing: the column under the cursor wins as soon as
  // the pointer enters it; corner distance only decides outside any column.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0
      ? pointerCollisions
      : closestCorners(args);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.8",
        },
      },
    }),
    duration: 300,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !project?.columns) return;

    const activeId = active.id.toString();
    // Drops on a top-bar chip target the chip's column (appended at the end).
    const rawOverId = over.id.toString();
    const overId = rawOverId.startsWith(DROP_CHIP_PREFIX)
      ? rawOverId.slice(DROP_CHIP_PREFIX.length)
      : rawOverId;

    const dragSourceColumn = project.columns.find((col) =>
      col.tasks.some((task) => task.id === activeId),
    );
    const dragDestinationColumn = project.columns.find(
      (col) =>
        col.id === overId || col.tasks.some((task) => task.id === overId),
    );

    if (
      dragSourceColumn &&
      dragDestinationColumn &&
      !isTransitionAllowed(
        project.columnTransitions,
        dragSourceColumn.id,
        dragDestinationColumn.id,
      )
    ) {
      return;
    }

    // Dragging a card that belongs to a multi-selection moves the whole
    // selection (same-column companions only — selection is column-scoped).
    const selectionState = useBulkSelectionStore.getState();
    const isMultiDrag =
      selectionState.selectedTaskIds.has(activeId) &&
      selectionState.selectedTaskIds.size > 1 &&
      dragSourceColumn &&
      dragDestinationColumn &&
      dragSourceColumn.id !== dragDestinationColumn.id;

    if (isMultiDrag && dragSourceColumn && dragDestinationColumn) {
      const companionIds = dragSourceColumn.tasks
        .filter(
          (t) => selectionState.selectedTaskIds.has(t.id) && t.id !== activeId,
        )
        .map((t) => t.id);
      const movingIds = [activeId, ...companionIds];

      const updatedProjectMulti = produce(project, (draft) => {
        const sourceColumn = draft?.columns?.find(
          (col) => col.id === dragSourceColumn.id,
        );
        const destinationColumn = draft?.columns?.find(
          (col) => col.id === dragDestinationColumn.id,
        );
        if (!sourceColumn || !destinationColumn) return;

        const movingTasks = sourceColumn.tasks.filter((t) =>
          movingIds.includes(t.id),
        );
        sourceColumn.tasks = sourceColumn.tasks.filter(
          (t) => !movingIds.includes(t.id),
        );
        destinationColumn.tasks.push(
          ...movingTasks.map((t) => ({ ...t, status: destinationColumn.id })),
        );

        destinationColumn.tasks.forEach((t, index) => {
          if (movingIds.includes(t.id)) {
            updateTask({ ...t, status: destinationColumn.id, position: index });
          }
        });
        sourceColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index });
        });
      });

      queryClient.cancelQueries({ queryKey: ["tasks", project.id] });
      queryClient.setQueryData(["tasks", project.id], updatedProjectMulti);
      setProject(updatedProjectMulti);
      selectionState.clearSelection();
      return;
    }

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft?.columns?.find((col) =>
        col.tasks.some((task) => task.id === activeId),
      );
      const destinationColumn = draft?.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const sourceTaskIndex = sourceColumn.tasks.findIndex(
        (task) => task.id === activeId,
      );
      const task = sourceColumn.tasks[sourceTaskIndex];

      sourceColumn.tasks = sourceColumn.tasks.filter((t) => t.id !== activeId);

      if (sourceColumn.id === destinationColumn.id) {
        let destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }
        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index });
        });

        queryClient.invalidateQueries({
          queryKey: ["projects", project.workspaceId],
        });
      } else {
        task.status = destinationColumn.id;
        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId) + 1;

        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, status: destinationColumn.id, position: index });
        });

        sourceColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index });
        });
      }
    });

    // Seed the query cache with the optimistic layout and drop any refetch
    // already in the air — otherwise a stale response lands after the drop
    // and snaps the card back to its old position for a frame.
    queryClient.cancelQueries({ queryKey: ["tasks", project.id] });
    queryClient.setQueryData(["tasks", project.id], updatedProject);
    setProject(updatedProject);
    setActiveId(null);
  };

  if (!project?.columns) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/25 to-background">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="flex h-full flex-1 gap-4 overflow-x-auto px-4 pb-4 md:px-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="h-full min-w-80 w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={`kanban-task-skeleton-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                        j
                      }`}
                      className="p-4 bg-card rounded-lg border border-border/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-muted/70 rounded" />
                        <div className="w-1/2 h-3 bg-muted/70 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeTask = activeId
    ? project.columns
        .flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  const activeSourceColumnId = activeId
    ? (project.columns.find((col) =>
        col.tasks.some((task) => task.id === activeId),
      )?.id ?? null)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Invalid columns collapse while dragging, shifting every column's
      // rect mid-drag — remeasure droppables on re-render or drops land in
      // the wrong column.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="relative flex h-full w-full flex-col bg-linear-to-b from-muted/20 to-background">
        <DropChipBar
          columns={project.columns}
          columnTransitions={project.columnTransitions}
          activeSourceColumnId={activeSourceColumnId}
          onChipClick={scrollToColumn}
        />
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]"
        >
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {project.columns?.map((column) => (
              <div
                key={column.id}
                ref={(node) => {
                  if (node) columnRefs.current.set(column.id, node);
                  else columnRefs.current.delete(column.id);
                }}
                className="h-full max-w-96 min-w-80 shrink-0 flex-1"
              >
                <Column
                  column={column}
                  disableDragDrop={disableDragDrop}
                  activeSourceColumnId={activeSourceColumnId}
                  isValidDropTarget={
                    !activeSourceColumnId ||
                    isTransitionAllowed(
                      project.columnTransitions,
                      activeSourceColumnId,
                      column.id,
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay
        dropAnimation={dropAnimation}
        modifiers={[snapTopCenterToCursor]}
      >
        {activeTask ? (
          <div className="relative transform rotate-1 scale-[1.03] shadow-lg">
            <div className="ring-2 ring-ring/35 rounded-lg">
              <TaskCard task={activeTask} />
            </div>
            {selectedTaskIds.has(activeTask.id) && selectedTaskIds.size > 1 && (
              <span className="-top-2 -right-2 absolute z-10 rounded-full bg-primary px-1.5 py-0.5 font-medium text-primary-foreground text-xs shadow">
                {selectedTaskIds.size}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
