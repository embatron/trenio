import postgres from "postgres";

const handle = process.env.OUTREACH_HANDLE || "";
const token = process.env.OUTREACH_TOKEN || "";
const outreach = process.env.OUTREACH_AT || "";
const link = process.env.LINK_AT || "";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const cols = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_profiles' AND column_name = 'outreach_sent_at'
  `;
  if (!cols.length) await sql.unsafe("ALTER TABLE trainer_profiles ADD COLUMN outreach_sent_at timestamptz");
  const rows = await sql`
    SELECT preview_token
    FROM trainer_profiles
    WHERE instagram_handle = ${handle} OR slug = ${handle}
    LIMIT 1
  `;
  const current = rows[0]?.preview_token || "";
  const next = current || token;
  if (rows[0] && next && next !== current) {
    await sql`
      UPDATE trainer_profiles
      SET preview_token = ${next}, updated_at = now()
      WHERE (instagram_handle = ${handle} OR slug = ${handle})
        AND preview_token IS NULL
    `;
  }
  if (rows[0] && outreach) {
    await sql`
      UPDATE trainer_profiles
      SET outreach_sent_at = COALESCE(outreach_sent_at, ${outreach}::timestamptz)
      WHERE instagram_handle = ${handle} OR slug = ${handle}
    `;
  }
  if (rows[0] && link) {
    await sql`
      UPDATE trainer_profiles
      SET invite_sent_at = COALESCE(invite_sent_at, ${link}::timestamptz)
      WHERE instagram_handle = ${handle} OR slug = ${handle}
    `;
  }
  console.log(JSON.stringify({ ok: Boolean(rows[0]), token: next }));
} finally {
  await sql.end({ timeout: 5 });
}
