import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery_hashes text",
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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("auth security tables are ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
