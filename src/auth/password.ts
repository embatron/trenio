import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { storedBelarusPhone } from "@/lib/auth/phone";

export { validatePasswordStrength } from "@/lib/auth/password-policy";

const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
} as const;

const KEY_LENGTH = 64;

/** Precomputed hash for timing-safe login when user does not exist. */
let dummyPasswordHash: string | null = null;

export async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await hashPassword("trenio-timing-safe-dummy-password");
  }
  return dummyPasswordHash;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  try {
    const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Account phone ready for `users.phone`. Same string as `storedBelarusPhone`. */
export function normalizePhone(phone: string | undefined | null): string | null {
  return storedBelarusPhone(phone);
}
