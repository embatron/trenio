import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { storedBelarusPhone } from "@/lib/auth/phone";

export { validatePasswordStrength } from "@/lib/auth/password-policy";

/** OWASP scrypt: N = 2^17, r = 8, p = 1. Memory is 128·N·r bytes. */
const SCRYPT_N = 131072;
const SCRYPT_LEGACY_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
const KEY_LENGTH = 64;
const PASSWORD_MAX = 128;

function scryptOptions(n: number) {
  return { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM };
}

function parseStoredHash(passwordHash: string): { n: number; salt: string; hash: Buffer } | null {
  const parts = passwordHash.split(":");
  if (parts[0] !== "scrypt") return null;
  let n = SCRYPT_LEGACY_N;
  let salt = "";
  let hex = "";
  if (parts.length === 3) {
    salt = parts[1] ?? "";
    hex = parts[2] ?? "";
  } else if (parts.length === 4) {
    n = Number(parts[1]);
    salt = parts[2] ?? "";
    hex = parts[3] ?? "";
  } else {
    return null;
  }
  if (n !== SCRYPT_LEGACY_N && n !== SCRYPT_N) return null;
  if (!salt || !hex) return null;
  const hash = Buffer.from(hex, "hex");
  if (hash.length !== KEY_LENGTH) return null;
  return { n, salt, hash };
}

/** Precomputed hash for timing-safe login when user does not exist. */
let dummyPasswordHash: string | null = null;

export async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await hashPassword("trenio-timing-safe-dummy-password");
  }
  return dummyPasswordHash;
}

export function passwordNeedsRehash(passwordHash: string): boolean {
  const parsed = parseStoredHash(passwordHash);
  return !parsed || parsed.n !== SCRYPT_N;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length > PASSWORD_MAX) {
    throw new Error("password too long");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, scryptOptions(SCRYPT_N)).toString("hex");
  return `scrypt:${SCRYPT_N}:${salt}:${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX) return false;
  const parsed = parseStoredHash(passwordHash);
  if (!parsed) return false;
  try {
    const derived = scryptSync(password, parsed.salt, KEY_LENGTH, scryptOptions(parsed.n));
    if (derived.length !== parsed.hash.length) return false;
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

/** After a real password match, replace a legacy cost with the current one. */
export async function upgradePasswordHash(userId: string, password: string, stored: string): Promise<void> {
  if (!passwordNeedsRehash(stored)) return;
  try {
    const { getDb } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await getDb()
      .update(users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    const { logCaught } = await import("@/lib/log/logger");
    logCaught("auth", "auth.login", error, { actorUserId: userId });
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Account phone ready for `users.phone`. Same string as `storedBelarusPhone`. */
export function normalizePhone(phone: string | undefined | null): string | null {
  return storedBelarusPhone(phone);
}
