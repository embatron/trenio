import { timingSafeEqual } from "node:crypto";

import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";

const TOKEN = /^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

export function syncAuthorized(header: string | null, expected = process.env.SYNC_TOKEN ?? ""): boolean {
  if (expected.length < 32) return false;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function cleanHandle(value: string) {
  return instagramProfileSlug(value);
}

/**
 * The laptop fixture `test-trener`. Cleaning drops the hyphen, so both spellings match.
 * Sync must not copy this card, its photos, or its marks in either direction.
 */
const LOCAL_ONLY_HANDLES = new Set(["testtrener"]);

export function isLocalOnlyTrainer(value: string) {
  const raw = value.trim().toLowerCase();
  return raw === "test-trener" || LOCAL_ONLY_HANDLES.has(cleanHandle(value));
}

/** A new timestamp fills an empty mark. An existing mark stays. */
export function nextStamp(current: Date | null, incoming: unknown): Date | null {
  if (typeof incoming !== "string" || !incoming.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(incoming)) return null;
  const next = new Date(incoming);
  if (Number.isNaN(next.getTime())) return null;
  if (current) return null;
  return next;
}

export function nextToken(current: string | null, incoming: unknown): string | null {
  if (current) return null;
  if (typeof incoming !== "string" || !TOKEN.test(incoming)) return null;
  return incoming;
}

export function trainerFileName(handle: string, name: string) {
  const slug = cleanHandle(handle);
  if (!slug || name !== name.trim()) return false;
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:-[a-z0-9]+)*\\.(?:jpg|pdf)$`).test(name);
}

export function looksLikeMedia(name: string, bytes: Uint8Array) {
  if (name.endsWith(".jpg")) return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (name.endsWith(".pdf")) {
    return bytes.length >= 4 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "%PDF";
  }
  return false;
}
