import path from "node:path";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { writeImageSet } from "@/lib/images/store";
import { logCaught, writeLog } from "@/lib/log/logger";

const PLACEHOLDER = "Пользователь";

export function oauthNamePatch(
  current: { firstName: string; lastName: string | null },
  incoming: { firstName: string; lastName: string },
): { firstName?: string; lastName?: string } {
  const patch: { firstName?: string; lastName?: string } = {};
  const first = incoming.firstName.trim();
  const last = incoming.lastName.trim();
  const missingFirst = !current.firstName.trim() || current.firstName.trim() === PLACEHOLDER;
  if (first && first !== PLACEHOLDER && missingFirst) patch.firstName = first;
  if (last && !current.lastName?.trim()) patch.lastName = last;
  return patch;
}

/** Fills an empty name from Google or Yandex. A name the person already chose stays. */
export async function rememberOAuthNames(
  userId: string,
  incoming: { firstName: string; lastName?: string | null },
) {
  const db = getDb();
  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status === "deleted" || user.status === "suspended") return;
  const patch = oauthNamePatch(user, { firstName: incoming.firstName, lastName: incoming.lastName ?? "" });
  if (!patch.firstName && !patch.lastName) return;
  await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, userId));
}

function allowedPortrait(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  if (host === "avatars.yandex.net" || host === "avatars.mds.yandex.net") {
    return parsed.pathname.startsWith("/get-yapic/") || parsed.pathname === "/i" || parsed.pathname.startsWith("/i/");
  }
  return host === "googleusercontent.com" || host.endsWith(".googleusercontent.com");
}

function filledPicture(value: string): boolean {
  return value.split("?")[0].trim() !== "";
}

/** The account photo or a trainer card photo is already theirs. Do not replace it. */
export function keepsOwnPortrait(accountPath: string, cardPaths: string[]): boolean {
  return filledPicture(accountPath) || cardPaths.some(filledPicture);
}

function looksLikeImage(bytes: Buffer, type: string): boolean {
  if (/^image\/(jpeg|jpg|png|webp)/i.test(type)) return true;
  if (type && !/^application\/octet-stream/i.test(type)) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return true;
  return bytes.slice(0, 4).toString() === "RIFF" && bytes.slice(8, 12).toString() === "WEBP";
}

/** Stores a provider portrait when the account has no photo. A failure still leaves the person signed in. */
export async function applyExternalPortrait(userId: string, avatarUrl: string | null, action: string) {
  if (!avatarUrl || !allowedPortrait(avatarUrl)) return;
  try {
    const db = getDb();
    const [user] = await db
      .select({ avatarPath: users.avatarPath, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.status === "deleted" || user.status === "suspended") return;
    const cards = await db
      .select({ avatarPath: trainerProfiles.avatarPath, photos: trainerProfiles.photos })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, userId));
    const cardPaths = cards.flatMap((card) => [card.avatarPath, ...(card.photos ?? [])]);
    if (keepsOwnPortrait(user.avatarPath, cardPaths)) return;
    const response = await fetch(avatarUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
    if (!response.ok || !allowedPortrait(response.url)) {
      void writeLog({
        level: "warn",
        domain: "auth",
        action,
        outcome: "failure",
        message: "Портрет не сохранился.",
        actorUserId: userId,
        context: { reason: response.ok ? "host" : "http" },
      });
      return;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 1_500_000 || !looksLikeImage(bytes, response.headers.get("content-type") ?? "")) {
      void writeLog({
        level: "warn",
        domain: "auth",
        action,
        outcome: "failure",
        message: "Портрет не сохранился.",
        actorUserId: userId,
        context: { reason: "type" },
      });
      return;
    }
    const relative = `/avatars/${userId}.jpg`;
    await writeImageSet(bytes, path.join(process.cwd(), "public", relative), "centre", "later");
    await db
      .update(users)
      .set({ avatarPath: relative, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.avatarPath, "")));
  } catch (error) {
    logCaught("auth", action, error);
  }
}
