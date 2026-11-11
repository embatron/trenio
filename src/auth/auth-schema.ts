import { sql } from "drizzle-orm";

import { getDb } from "@/db";

const STATEMENTS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub varchar(255)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_sub varchar(255)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at timestamptz",
  `UPDATE users SET password_set_at = created_at
   WHERE password_set_at IS NULL
     AND google_sub IS NULL
     AND yandex_sub IS NULL
     AND needs_password = false
     AND email NOT LIKE 'pending.%@users.trenio.invalid'`,
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_bot_seen_at timestamptz",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users (google_sub)",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_yandex_sub_unique ON users (yandex_sub)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery_hashes text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_messages boolean NOT NULL DEFAULT true",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_signup_draft text",
  "ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0",
  `CREATE TABLE IF NOT EXISTS auth_rate_buckets (
    bucket_key varchar(420) PRIMARY KEY,
    window_start timestamptz NOT NULL,
    hit_count integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_replay_keys (
    key_hash varchar(64) PRIMARY KEY,
    expires_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_step_up_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel varchar(16) NOT NULL,
    code_hash varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_step_up_grants (
    token_hash varchar(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_login_tickets (
    token_hash varchar(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_door_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    email varchar(320) NOT NULL,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

let ready: Promise<void> | null = null;

/** Idempotent columns and tables for the auth fixes. Safe to call on every request. */
export function ensureAuthSchema(): Promise<void> {
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
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}
