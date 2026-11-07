import path from "node:path";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { writeImageSet } from "@/lib/images/store";
import { logCaught } from "@/lib/log/logger";

const PORTRAIT_HOSTS = new Set(["avatars.yandex.net", "avatars.mds.yandex.net"]);

function looksLikeImage(bytes: Buffer, type: string): boolean {
  if (/^image\/(jpeg|jpg|png|webp)/i.test(type)) return true;
  if (type && !/^application\/octet-stream/i.test(type)) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return true;
  return bytes.slice(0, 4).toString() === "RIFF" && bytes.slice(8, 12).toString() === "WEBP";
}

/** Stores the Yandex portrait as the account photo when the account has none. A failure still leaves the person signed in. */
export async function applyYandexPortrait(userId: string, avatarUrl: string | null) {
  if (!avatarUrl?.startsWith("https://avatars.yandex.net/get-yapic/")) return;
  try {
    const db = getDb();
    const [user] = await db
      .select({ avatarPath: users.avatarPath, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.avatarPath || user.status === "deleted" || user.status === "suspended") return;
    const response = await fetch(avatarUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return;
    const host = new URL(response.url).hostname;
    if (!PORTRAIT_HOSTS.has(host)) return;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 1_500_000) return;
    if (!looksLikeImage(bytes, response.headers.get("content-type") ?? "")) return;
    const relative = `/avatars/${userId}.jpg`;
    await writeImageSet(bytes, path.join(process.cwd(), "public", relative), "centre", "later");
    await db
      .update(users)
      .set({ avatarPath: relative, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.avatarPath, "")));
  } catch (error) {
    logCaught("auth", "auth.login.yandex", error);
  }
}
