import { useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
  activeSourceColumnId?: string | null;
  isValidDropTarget?: boolean;
};

function Column({
  column,
  disableDragDrop = false,
  activeSourceColumnId = null,
  isValidDropTarget = true,
}: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);

  return (
    <div
      className={`group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-[opacity,background-color,border-color,box-shadow] duration-150 ${
        isValidDropTarget
          ? isDropzoneOver
            ? "border-ring/40 bg-accent/60 shadow-md ring-2 ring-ring/30"
            : "border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90"
          : "border-border/50 bg-muted/30 opacity-40 saturate-50 cursor-not-allowed dark:bg-card/60"
      }`}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader column={column} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-1 [-webkit-overflow-scrolling:touch]">
        <ColumnDropzone
          column={column}
          disableDragDrop={disableDragDrop}
          onIsOverChange={setIsDropzoneOver}
          activeSourceColumnId={activeSourceColumnId}
          isValidDropTarget={isValidDropTarget}
        />
      </div>
    </div>
  );
}

export default Column;
