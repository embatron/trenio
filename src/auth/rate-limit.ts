import { sql } from "drizzle-orm";

import { getDb } from "@/db";

import { ensureAuthSchema } from "./auth-schema";

type Bucket = { start: number; count: number };

const memory = new Map<string, Bucket>();

export const RATE_LIMITS = {
  loginIp: { windowMs: 15 * 60_000, max: 12 },
  loginId: { windowMs: 15 * 60_000, max: 10 },
  otpPhone: { windowMs: 60_000, max: 1 },
  otpIp: { windowMs: 15 * 60_000, max: 6 },
  forgotIp: { windowMs: 15 * 60_000, max: 5 },
  forgotEmail: { windowMs: 15 * 60_000, max: 5 },
  geocodeUser: { windowMs: 1_000, max: 1 },
} as const;

export const RATE_LIMITED_MESSAGE = "Слишком много попыток. Подождите и попробуйте снова.";

function remember(key: string, windowMs: number, now: number) {
  const row = memory.get(key);
  if (!row || now - row.start >= windowMs) {
    memory.set(key, { start: now, count: 1 });
    return { count: 1, start: now };
  }
  row.count += 1;
  return row;
}

/**
 * Shared counter. Postgres is the source of truth so a second process and a
 * restart keep the same window. If the table is unreachable, the same process
 * keeps counting in memory and still allows requests until that window is full.
 */
export async function consumeRateLimit(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = Date.now();
  try {
    await ensureAuthSchema();
    const result = await getDb().execute(sql`
      INSERT INTO auth_rate_buckets (bucket_key, window_start, hit_count)
      VALUES (${key}, ${new Date(now).toISOString()}, 1)
      ON CONFLICT (bucket_key) DO UPDATE SET
        hit_count = CASE
          WHEN auth_rate_buckets.window_start + (${windowMs}::int * interval '1 millisecond') <= ${new Date(now).toISOString()} THEN 1
          ELSE auth_rate_buckets.hit_count + 1
        END,
        window_start = CASE
          WHEN auth_rate_buckets.window_start + (${windowMs}::int * interval '1 millisecond') <= ${new Date(now).toISOString()} THEN ${new Date(now).toISOString()}
          ELSE auth_rate_buckets.window_start
        END
      RETURNING hit_count, window_start
    `);
    const row = firstRow(result);
    if (!row) throw new Error("rate bucket missing");
    const count = Number(row.hit_count);
    const start = new Date(String(row.window_start)).getTime();
    if (count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((start + windowMs - now) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch {
    const row = remember(key, windowMs, now);
    if (row.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((row.start + windowMs - now) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  }
}

/** Current hits in the open window. Does not increment. */
export async function readRateLimit(key: string, windowMs: number): Promise<number> {
  const now = Date.now();
  try {
    await ensureAuthSchema();
    const result = await getDb().execute(sql`
      SELECT hit_count, window_start FROM auth_rate_buckets WHERE bucket_key = ${key}
    `);
    const row = firstRow(result);
    if (!row) return 0;
    const start = new Date(String(row.window_start)).getTime();
    if (now - start >= windowMs) return 0;
    return Number(row.hit_count);
  } catch {
    const row = memory.get(key);
    if (!row || now - row.start >= windowMs) return 0;
    return row.count;
  }
}

function firstRow(result: unknown): { hit_count: unknown; window_start: unknown } | null {
  if (Array.isArray(result)) {
    return (result[0] as { hit_count: unknown; window_start: unknown } | undefined) ?? null;
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown[] }).rows;
    return (rows?.[0] as { hit_count: unknown; window_start: unknown } | undefined) ?? null;
  }
  return null;
}
