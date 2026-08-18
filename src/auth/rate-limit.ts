import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { authRateLimits } from "@/db/schema";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export const RATE_LIMITS = {
  loginIp: { windowMs: 15 * 60_000, max: 12 },
  otpPhone: { windowMs: 60_000, max: 1 },
  otpIp: { windowMs: 15 * 60_000, max: 6 },
  registerIp: { windowMs: 60 * 60_000, max: 6 },
  forgotIp: { windowMs: 15 * 60_000, max: 5 },
  emailChangeIp: { windowMs: 15 * 60_000, max: 5 },
} as const;

export const RATE_LIMITED_MESSAGE = "Слишком много попыток. Подождите минуту и попробуйте снова.";

export async function consumeRateLimit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  const now = Date.now();
  const db = getDb();
  const [row] = await db.select().from(authRateLimits).where(eq(authRateLimits.key, key)).limit(1);

  if (!row || now - row.windowStartedAt >= windowMs) {
    await db
      .insert(authRateLimits)
      .values({ key, windowStartedAt: now, count: 1 })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: { windowStartedAt: now, count: 1 },
      });
    return { ok: true };
  }

  if (row.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - row.windowStartedAt)) / 1000));
    return { ok: false, retryAfterSec };
  }

  await db
    .update(authRateLimits)
    .set({ count: row.count + 1 })
    .where(eq(authRateLimits.key, key));
  return { ok: true };
}
