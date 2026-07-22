ALTER TABLE "task" ADD COLUMN "type" text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "parent_task_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_parent_task_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_parentTaskId_idx" ON "task" USING btree ("parent_task_id");