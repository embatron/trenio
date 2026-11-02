import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_messages boolean NOT NULL DEFAULT true",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_reviews boolean NOT NULL DEFAULT true",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_site boolean NOT NULL DEFAULT true",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_marketing boolean NOT NULL DEFAULT false",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password boolean NOT NULL DEFAULT false",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("mail preference columns are ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
