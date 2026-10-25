import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Operational journal. No foreign key on actor_user_id: a deleted account must
 * not erase the row before the 30-day expiry. Install with `npm run logs:install`.
 * Do not use `db:push` — the live `otp_purpose` enum does not match Drizzle.
 */
export const appLogs = pgTable(
  "app_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    level: varchar("level", { length: 8 }).notNull(),
    domain: varchar("domain", { length: 16 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    outcome: varchar("outcome", { length: 16 }),
    message: text("message").notNull(),
    actorUserId: uuid("actor_user_id"),
    subject: varchar("subject", { length: 320 }),
    target: varchar("target", { length: 80 }),
    requestId: varchar("request_id", { length: 64 }),
    route: varchar("route", { length: 300 }),
    httpMethod: varchar("http_method", { length: 8 }),
    statusCode: integer("status_code"),
    durationMs: integer("duration_ms"),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 300 }),
    errorName: varchar("error_name", { length: 120 }),
    errorCode: varchar("error_code", { length: 64 }),
    stack: text("stack"),
    context: jsonb("context").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("app_logs_created_idx").on(table.createdAt.desc()),
    index("app_logs_expires_idx").on(table.expiresAt),
    index("app_logs_domain_created_idx").on(table.domain, table.createdAt.desc()),
    index("app_logs_level_created_idx").on(table.level, table.createdAt.desc()),
    index("app_logs_subject_created_idx").on(table.subject, table.createdAt.desc()),
    index("app_logs_actor_created_idx").on(table.actorUserId, table.createdAt.desc()),
    index("app_logs_target_created_idx").on(table.target, table.createdAt.desc()),
    index("app_logs_request_idx").on(table.requestId),
    index("app_logs_action_created_idx").on(table.action, table.createdAt.desc()),
    index("app_logs_errors_idx")
      .on(table.createdAt.desc())
      .where(sql`${table.level} in ('warn', 'error', 'fatal')`),
  ],
);
