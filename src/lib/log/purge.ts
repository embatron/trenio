import postgres from "postgres";
import { lt } from "drizzle-orm";

import { getDb } from "@/db";
import { appLogs } from "@/db/schema";

export async function purgeExpiredLogs(now = new Date()): Promise<number> {
  const deleted = await getDb()
    .delete(appLogs)
    .where(lt(appLogs.expiresAt, now))
    .returning({ id: appLogs.id });
  return deleted.length;
}

export const APP_LOGS_DDL = `
CREATE TABLE IF NOT EXISTS app_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  level varchar(8) NOT NULL,
  domain varchar(16) NOT NULL,
  action varchar(80) NOT NULL,
  outcome varchar(16),
  message text NOT NULL,
  actor_user_id uuid,
  subject varchar(320),
  target varchar(80),
  request_id varchar(64),
  route varchar(300),
  http_method varchar(8),
  status_code integer,
  duration_ms integer,
  ip varchar(64),
  user_agent varchar(300),
  error_name varchar(120),
  error_code varchar(64),
  stack text,
  context jsonb
);
CREATE INDEX IF NOT EXISTS app_logs_created_idx ON app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_expires_idx ON app_logs (expires_at);
CREATE INDEX IF NOT EXISTS app_logs_domain_created_idx ON app_logs (domain, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_level_created_idx ON app_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_subject_created_idx ON app_logs (subject, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_actor_created_idx ON app_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_target_created_idx ON app_logs (target, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_request_idx ON app_logs (request_id);
CREATE INDEX IF NOT EXISTS app_logs_action_created_idx ON app_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_errors_idx ON app_logs (created_at DESC) WHERE level IN ('warn', 'error', 'fatal');
`.trim();

export async function installAppLogs(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const statements = APP_LOGS_DDL.split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
