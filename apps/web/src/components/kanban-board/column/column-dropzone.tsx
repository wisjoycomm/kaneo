import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect } from "react";
import type { ProjectWithTasks } from "@/types/project";
import TaskCard from "../task-card";

type ColumnDropzoneProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
  onIsOverChange?: (isOver: boolean) => void;
  activeSourceColumnId?: string | null;
  isValidDropTarget?: boolean;
};

export function ColumnDropzone({
  column,
  disableDragDrop = false,
  onIsOverChange,
  activeSourceColumnId = null,
  isValidDropTarget = true,
}: ColumnDropzoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: disableDragDrop || !isValidDropTarget,
    data: {
      type: "column",
      column,
    },
  });
  const { active, over } = useDndContext();

  // useDroppable's isOver only fires over the column's own body; while the
  // pointer is over a card inside the column, `over` is that card's sortable.
  // Treat both as "over this column" so the highlight tracks the real target.
  const isOverColumn =
    isOver ||
    (!!active &&
      !!over &&
      (over.id === column.id ||
        column.tasks.some((task) => task.id === over.id)));

  useEffect(() => {
    onIsOverChange?.(isOverColumn);
  }, [isOverColumn, onIsOverChange]);

  const reduceMotion = useReducedMotion();

  // Drop-position preview for cards dragged in from another column
  // (same-column previews are handled by the sortable placeholder itself).
  let previewIndex = -1;
  if (
    active &&
    over &&
    isValidDropTarget &&
    activeSourceColumnId &&
    activeSourceColumnId !== column.id
  ) {
    if (over.id === column.id) {
      previewIndex = column.tasks.length;
    } else {
      const overTaskIndex = column.tasks.findIndex(
        (task) => task.id === over.id,
      );
      if (overTaskIndex !== -1) previewIndex = overTaskIndex + 1;
    }
  }
  const previewHeight = active?.rect.current.initial?.height ?? 80;

  const items: ReactNode[] = column.tasks.map((task) => (
    <motion.div
      key={task.id}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
    >
      <TaskCard task={task} disableDragDrop={disableDragDrop} />
    </motion.div>
  ));

  if (previewIndex !== -1) {
    items.splice(
      previewIndex,
      0,
      <motion.div
        key="drop-position-preview"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        <div
          className="rounded-lg border-2 border-dashed border-ring/50 bg-accent/30"
          style={{ height: previewHeight }}
        />
      </motion.div>,
    );
  }

  return (
    <div ref={setNodeRef} className="flex-1 min-h-0">
      <SortableContext
        items={column.tasks}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {items}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  );
}
