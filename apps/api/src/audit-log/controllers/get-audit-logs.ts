import { count, desc, eq } from "drizzle-orm";
import db from "../../database";
import { auditLogTable } from "../../database/schema";

async function getAuditLogs(
  workspaceId: string,
  limit: number,
  offset: number,
) {
  const [items, [total]] = await Promise.all([
    db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.workspaceId, workspaceId))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(auditLogTable)
      .where(eq(auditLogTable.workspaceId, workspaceId)),
  ]);

  return { items, total: total?.value ?? 0 };
}

export default getAuditLogs;
