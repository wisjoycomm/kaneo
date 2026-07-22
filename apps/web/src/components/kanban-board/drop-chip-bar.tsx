import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { ColumnTransitions } from "@/lib/column-transitions";
import { isTransitionAllowed } from "@/lib/column-transitions";
import type { ProjectWithTasks } from "@/types/project";

export const DROP_CHIP_PREFIX = "drop-chip:";

function DropChip({
  column,
  isValid,
  isDragging,
  onClick,
}: {
  column: ProjectWithTasks["columns"][number];
  isValid: boolean;
  isDragging: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${DROP_CHIP_PREFIX}${column.id}`,
    disabled: !isValid,
    data: { type: "column-chip", columnId: column.id },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        isOver && isValid
          ? "border-ring bg-accent text-accent-foreground ring-2 ring-ring/40"
          : "border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
        isDragging && !isValid && "pointer-events-none opacity-40 saturate-50",
      )}
    >
      {column.name}
      <span className="text-[10px] text-muted-foreground/70">
        {column.tasks.length}
      </span>
    </button>
  );
}

type DropChipBarProps = {
  columns: ProjectWithTasks["columns"];
  columnTransitions: ColumnTransitions | undefined;
  activeSourceColumnId: string | null;
  onChipClick: (columnId: string) => void;
};

// Always-visible column bar: click a chip to scroll its column into view;
// while dragging, chips double as drop targets (card lands at column end)
// and invalid transitions dim out.
export default function DropChipBar({
  columns,
  columnTransitions,
  activeSourceColumnId,
  onChipClick,
}: DropChipBarProps) {
  const { t } = useTranslation();

  if (columns.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border/60 bg-background/95 px-4 py-2 md:px-5">
      <span className="shrink-0 text-xs text-muted-foreground">
        {t("tasks:board.columns", { defaultValue: "Columns" })}
      </span>
      {columns.map((column) => (
        <DropChip
          key={column.id}
          column={column}
          isDragging={Boolean(activeSourceColumnId)}
          isValid={
            !activeSourceColumnId ||
            isTransitionAllowed(
              columnTransitions,
              activeSourceColumnId,
              column.id,
            )
          }
          onClick={() => onChipClick(column.id)}
        />
      ))}
    </div>
  );
}
