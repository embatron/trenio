import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function pepper(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return "dev-only-trenio-otp-pepper-32chars!!";
}

function aesKey(): Buffer {
  return createHash("sha256").update(pepper()).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function openSecret(blob: string): string | null {
  const [ivPart, tagPart, encPart] = blob.split(".");
  if (!ivPart || !tagPart || !encPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function decodeBase32(text: string): Buffer {
  const clean = text.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotpCode(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(binary).padStart(DIGITS, "0");
}

export function totpCode(secret: Buffer, nowMs = Date.now()): string {
  return hotpCode(secret, Math.floor(nowMs / 1000 / STEP_SECONDS));
}

export function totpMatches(secret: Buffer, code: string, nowMs = Date.now()): boolean {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== DIGITS) return false;
  const counter = Math.floor(nowMs / 1000 / STEP_SECONDS);
  const given = Buffer.from(digits);
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step < 0) continue;
    const expected = Buffer.from(hotpCode(secret, step));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

export function recoveryHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function newRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => randomBytes(5).toString("hex"));
}

export function totpLabel(email: string): string {
  return isPendingSignupEmail(email) ? "Trenio" : email;
}

export function totpUri(email: string, secretBase32: string): string {
  const label = encodeURIComponent(totpLabel(email));
  return `otpauth://totp/Trenio:${label}?secret=${secretBase32}&issuer=Trenio&algorithm=SHA1&digits=6&period=30`;
}

export async function pendingTotpSecret(userId: string): Promise<string | null> {
  const [user] = await getDb()
    .select({ totpSecret: users.totpSecret, totpEnabledAt: users.totpEnabledAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.totpSecret || user.totpEnabledAt) return null;
  return openSecret(user.totpSecret);
}

export async function beginTotpEnrollment(userId: string, email: string) {
  const secret = randomBytes(20);
  const base32 = encodeBase32(secret);
  await getDb()
    .update(users)
    .set({ totpSecret: sealSecret(base32), totpEnabledAt: null, totpRecoveryHashes: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return { secret: base32, uri: totpUri(email, base32) };
}

export async function confirmTotpEnrollment(userId: string, code: string) {
  const [user] = await getDb()
    .select({ totpSecret: users.totpSecret, totpEnabledAt: users.totpEnabledAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.totpSecret) throw new AuthError("Сначала запросите код приложения.", "VALIDATION");
  const plain = openSecret(user.totpSecret);
  if (!plain || !totpMatches(decodeBase32(plain), code)) {
    throw new AuthError("Неверный код. Проверьте время на телефоне.", "INVALID_TOKEN");
  }
  const codes = newRecoveryCodes();
  await getDb()
    .update(users)
    .set({
      totpEnabledAt: new Date(),
      totpRecoveryHashes: JSON.stringify(codes.map(recoveryHash)),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return { codes };
}

function readRecovery(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Staff second factor. A recovery code works once. */
export async function consumeTotpFactor(userId: string, code: string): Promise<boolean> {
  const [user] = await getDb()
    .select({
      totpSecret: users.totpSecret,
      totpEnabledAt: users.totpEnabledAt,
      totpRecoveryHashes: users.totpRecoveryHashes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.totpEnabledAt || !user.totpSecret) return false;
  const plain = openSecret(user.totpSecret);
  if (plain && totpMatches(decodeBase32(plain), code)) return true;
  const hashes = readRecovery(user.totpRecoveryHashes);
  const next = hashes.filter((item) => item !== recoveryHash(code.trim().toLowerCase()));
  if (next.length === hashes.length) return false;
  await getDb()
    .update(users)
    .set({ totpRecoveryHashes: JSON.stringify(next), updatedAt: new Date() })
    .where(eq(users.id, userId));
  return true;
}
