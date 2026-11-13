import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let ready: Promise<void> | null = null;

/** Push subscriptions for message notices. Safe to call on every request. */
export function ensurePushSchema(): Promise<void> {
  if (!ready) {
    ready = apply().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function apply() {
  const db = getDb();
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(
    "CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique ON push_subscriptions (endpoint)",
  ));
  await db.execute(sql.raw(
    "CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id)",
  ));
  await db.execute(sql.raw(
    "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web'",
  ));
  await db.execute(sql.raw(
    "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'vapid'",
  ));
  await db.execute(sql.raw(
    "CREATE INDEX IF NOT EXISTS push_subscriptions_user_platform_idx ON push_subscriptions (user_id, platform)",
  ));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform text NOT NULL,
      push_token text NOT NULL,
      token_type text NOT NULL,
      device_name text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, push_token)
    )
  `));
  await db.execute(sql.raw(
    "CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices (user_id)",
  ));
  await db.execute(sql.raw(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_messages boolean NOT NULL DEFAULT true",
  ));
}
