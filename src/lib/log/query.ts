import { and, desc, eq, gte, ilike, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { appLogs } from "@/db/schema";
import { isLogDomain, isLogLevel } from "@/lib/log/policy";
import { normalizeSubject } from "@/lib/log/redact";

export type LogFilter = {
  hours?: number;
  domain?: string;
  level?: string;
  subject?: string;
  actorUserId?: string;
  action?: string;
  target?: string;
  requestId?: string;
  query?: string;
  limit?: number;
};

export async function diagnoseLogs(filter: LogFilter) {
  const since = new Date(Date.now() - (filter.hours ?? 24) * 60 * 60 * 1000);
  const filters = [gte(appLogs.createdAt, since)];
  if (filter.domain && isLogDomain(filter.domain)) filters.push(eq(appLogs.domain, filter.domain));
  if (filter.level && isLogLevel(filter.level)) filters.push(eq(appLogs.level, filter.level));
  const subject = normalizeSubject(filter.subject);
  if (subject) filters.push(eq(appLogs.subject, subject));
  if (filter.actorUserId) filters.push(eq(appLogs.actorUserId, filter.actorUserId));
  if (filter.action) filters.push(eq(appLogs.action, filter.action.slice(0, 80)));
  if (filter.target) filters.push(eq(appLogs.target, filter.target.slice(0, 80)));
  if (filter.requestId) filters.push(eq(appLogs.requestId, filter.requestId.slice(0, 64)));
  if (filter.query) {
    const needle = `%${filter.query.replace(/[%_]/g, "").slice(0, 80)}%`;
    filters.push(ilike(appLogs.message, needle));
  }

  const where = and(...filters);
  const db = getDb();
  const [groups, rows] = await Promise.all([
    db
      .select({
        domain: appLogs.domain,
        action: appLogs.action,
        level: appLogs.level,
        outcome: appLogs.outcome,
        count: sql<number>`count(*)::int`,
      })
      .from(appLogs)
      .where(where)
      .groupBy(appLogs.domain, appLogs.action, appLogs.level, appLogs.outcome)
      .orderBy(sql`count(*) desc`)
      .limit(30),
    db.select().from(appLogs).where(where).orderBy(desc(appLogs.createdAt)).limit(filter.limit ?? 40),
  ]);

  return {
    since: since.toISOString(),
    groups,
    rows: rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      level: row.level,
      domain: row.domain,
      action: row.action,
      outcome: row.outcome,
      message: row.message,
      subject: row.subject,
      target: row.target,
      actorUserId: row.actorUserId,
      requestId: row.requestId,
      route: row.route,
      statusCode: row.statusCode,
      errorName: row.errorName,
      errorCode: row.errorCode,
      ip: row.ip,
      stack: row.stack,
      context: row.context,
    })),
  };
}
