import { desc, eq, or } from "drizzle-orm";

import { getDb } from "@/db";
import { appLogs, trainerJournal } from "@/db/schema";
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

  const limit = input.limit ?? 80;
  const db = getDb();
  const rows = await db
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
    .limit(limit);
  const kept = await db
    .select({
      createdAt: trainerJournal.createdAt,
      domain: trainerJournal.domain,
      action: trainerJournal.action,
      outcome: trainerJournal.outcome,
      message: trainerJournal.message,
      level: trainerJournal.level,
    })
    .from(trainerJournal)
    .where(or(...trainerParts(input, subject)))
    .orderBy(desc(trainerJournal.createdAt))
    .limit(limit)
    .catch(() => []);

  return dedupeJournal(
    [...rows.map(journalLine), ...kept.map((row) => journalLine({ ...row, errorCode: null }))],
    limit,
  );
}

function trainerParts(
  input: { actorUserId?: string | null; target?: string | null },
  subject: string | null,
) {
  const parts = [];
  if (input.actorUserId) parts.push(eq(trainerJournal.actorUserId, input.actorUserId));
  if (subject) parts.push(eq(trainerJournal.subject, subject));
  if (input.target) parts.push(eq(trainerJournal.target, input.target));
  return parts;
}

function dedupeJournal(lines: JournalLine[], limit: number): JournalLine[] {
  const sorted = lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const kept: JournalLine[] = [];
  for (const line of sorted) {
    const at = Date.parse(line.at);
    const duplicate = kept.some(
      (other) => other.detail === line.detail && Math.abs(Date.parse(other.at) - at) < 5000,
    );
    if (!duplicate) kept.push(line);
    if (kept.length >= limit) break;
  }
  return kept;
}

export function mergeJournal(current: JournalLine[], journal: JournalLine[], limit = 80): JournalLine[] {
  return [...journal, ...current].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
