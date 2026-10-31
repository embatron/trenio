import postgres from "postgres";

import { SITE_TEXT_DEFAULTS, SITE_TEXT_KEYS } from "../src/lib/site-texts/defaults";

const CREATE = `CREATE TABLE IF NOT EXISTS site_texts (
  key text PRIMARY KEY,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
)`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(CREATE);
    for (const key of SITE_TEXT_KEYS) {
      await sql`
        INSERT INTO site_texts (key, body)
        VALUES (${key}, ${SITE_TEXT_DEFAULTS[key]})
        ON CONFLICT (key) DO NOTHING
      `;
    }
    console.info("site_texts is ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
