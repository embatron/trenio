import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

import { ensureAuthSchema } from "./auth-schema";

function first(result: unknown): unknown {
  if (Array.isArray(result)) return result[0];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown[] }).rows;
    return rows?.[0];
  }
  return null;
}

/** Returns false when this exact proof was already accepted. */
export async function claimProof(key: string, expiresAt: Date): Promise<boolean> {
  await ensureAuthSchema();
  const keyHash = createHash("sha256").update(key).digest("hex");
  const db = getDb();
  await db.execute(sql`DELETE FROM auth_replay_keys WHERE expires_at < now()`);
  const inserted = await db.execute(sql`
    INSERT INTO auth_replay_keys (key_hash, expires_at)
    VALUES (${keyHash}, ${expiresAt.toISOString()})
    ON CONFLICT (key_hash) DO NOTHING
    RETURNING key_hash
  `);
  return Boolean(first(inserted));
}
