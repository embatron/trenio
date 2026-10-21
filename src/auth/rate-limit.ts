type Bucket = { start: number; count: number };

const buckets = new Map<string, Bucket>();

export const RATE_LIMITS = {
  loginIp: { windowMs: 15 * 60_000, max: 12 },
  loginId: { windowMs: 15 * 60_000, max: 8 },
  otpPhone: { windowMs: 60_000, max: 1 },
  otpIp: { windowMs: 15 * 60_000, max: 6 },
  forgotIp: { windowMs: 15 * 60_000, max: 5 },
} as const;

export const RATE_LIMITED_MESSAGE = "Слишком много попыток. Подождите и попробуйте снова.";

export function consumeRateLimit(
  key: string,
  windowMs: number,
  max: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const row = buckets.get(key);
  if (!row || now - row.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true };
  }
  if (row.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((row.start + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  row.count += 1;
  return { ok: true };
}
