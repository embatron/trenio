import { desc, eq, or } from "drizzle-orm";

import { getDb } from "@/db";
import { appLogs } from "@/db/schema";
import { journalLine, type JournalLine } from "@/lib/log/present";
import { normalizeSubject } from "@/lib/log/redact";

export async function listActorJournal(input: {
  actorUserId?: string | null;
  subject?: string | null;
  target?: string | null;
  limit?: number;
}): Promise<JournalLine[]> {
  const subject = normalizeSubject(input.subject);
  const parts = [];
  if (input.actorUserId) parts.push(eq(appLogs.actorUserId, input.actorUserId));
  if (subject) parts.push(eq(appLogs.subject, subject));
  if (input.target) parts.push(eq(appLogs.target, input.target));
  if (parts.length === 0) return [];

  const rows = await getDb()
    .select({
      createdAt: appLogs.createdAt,
      domain: appLogs.domain,
      action: appLogs.action,
      outcome: appLogs.outcome,
      message: appLogs.message,
      errorCode: appLogs.errorCode,
      level: appLogs.level,
    })
    .from(appLogs)
    .where(or(...parts))
    .orderBy(desc(appLogs.createdAt))
    .limit(input.limit ?? 80);

  return rows.map(journalLine);
}

export function mergeJournal(current: JournalLine[], journal: JournalLine[], limit = 80): JournalLine[] {
  return [...journal, ...current].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
