import { randomBytes } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { ensureTrainerDoorSchema } from "@/lib/catalog/trainer-door-schema";
import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";
import { SITE_ORIGIN } from "@/lib/seo/site";
import { writeLog } from "@/lib/log/logger";
import { relayDoorMark } from "@/lib/sync/relay";

const DOOR_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

function shortCode() {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i += 1) code += DOOR_ALPHABET[bytes[i] % DOOR_ALPHABET.length];
  return code;
}

const DOOR_CODE = /^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

export function isDoorCode(value: string | null | undefined): value is string {
  return typeof value === "string" && DOOR_CODE.test(value);
}

/**
 * The short link this database can open. A usable code stays.
 * A missing or legacy code is replaced here and is not pushed to the other database.
 */
export async function ensureLocalDoorCode(profileId: string, current: string | null): Promise<string | null> {
  if (isDoorCode(current)) return current;
  const db = getDb();
  let token = current;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = shortCode();
    try {
      const [updated] = await db
        .update(trainerProfiles)
        .set({ previewToken: next, updatedAt: new Date() })
        .where(and(
          eq(trainerProfiles.id, profileId),
          token ? eq(trainerProfiles.previewToken, token) : isNull(trainerProfiles.previewToken),
        ))
        .returning({ previewToken: trainerProfiles.previewToken });
      if (isDoorCode(updated?.previewToken)) return updated.previewToken;
    } catch {
      /* another request took this code */
    }
    const [fresh] = await db
      .select({ previewToken: trainerProfiles.previewToken })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.id, profileId))
      .limit(1);
    if (isDoorCode(fresh?.previewToken)) return fresh.previewToken;
    token = fresh?.previewToken ?? null;
  }
  return null;
}

export function doorUrl(code: string) {
  return `${SITE_ORIGIN}/hi/${code}`;
}

/**
 * Keep one short link for this card. A code that already exists on the live
 * site wins, so the address the admin copies is the one the trainer can open.
 */
export async function ensurePublicDoorLink(slug: string): Promise<string> {
  await ensureTrainerDoorSchema();
  const db = getDb();
  const [row] = await db
    .select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      handle: trainerProfiles.instagramHandle,
      previewToken: trainerProfiles.previewToken,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.slug, slug))
    .limit(1);
  if (!row) throw new Error("Профиль тренера не найден.");

  let code = row.previewToken ?? "";
  if (!code) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = shortCode();
      const [clash] = await db
        .select({ id: trainerProfiles.id })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.previewToken, next))
        .limit(1);
      if (!clash) {
        code = next;
        break;
      }
    }
    if (!code) throw new Error("Не удалось подготовить короткую ссылку.");
    await db.update(trainerProfiles).set({
      previewToken: code,
      editToken: null,
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, row.id));
  }

  const mirrored = await relayDoorMark({
    handle: row.handle || row.slug,
    token: code,
  });
  if (!mirrored.ok) throw new Error("Короткая ссылка не записалась на сервер.");
  if (mirrored.token && mirrored.token !== code) {
    code = mirrored.token;
    await db.update(trainerProfiles).set({
      previewToken: code,
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, row.id));
  }
  return doorUrl(code);
}

export type OutreachCandidate = {
  slug: string;
  handle: string;
  name: string;
};

export type OutreachScopeRow = OutreachCandidate & {
  send: boolean;
  reason: "unsent" | "sent" | "not-draft" | "missing";
};

function outreachHandle(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  const fromUrl = trimmed.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? trimmed;
  return instagramProfileSlug(fromUrl.replace(/\/+$/, ""));
}

/** The handles written with the command, in that order. Anyone else stays out. */
export async function resolveOutreachScope(rawHandles: string[]): Promise<OutreachScopeRow[]> {
  await ensureTrainerDoorSchema();
  const handles = rawHandles.map(outreachHandle).filter(Boolean);
  if (!handles.length) return [];
  const rows = await getDb()
    .select({
      slug: trainerProfiles.slug,
      handle: trainerProfiles.instagramHandle,
      status: trainerProfiles.status,
      firstName: trainerProfiles.firstName,
      fullName: trainerProfiles.fullName,
      outreachSentAt: trainerProfiles.outreachSentAt,
    })
    .from(trainerProfiles)
    .where(inArray(trainerProfiles.instagramHandle, [...new Set(handles)]));
  const byHandle = new Map(rows.map((row) => [row.handle, row]));
  return handles.map((handle) => {
    const row = byHandle.get(handle);
    if (!row) return { slug: "", handle, name: handle, send: false, reason: "missing" as const };
    const name = row.fullName.trim() || row.firstName.trim() || row.slug;
    if (row.status !== "draft") {
      return { slug: row.slug, handle, name, send: false, reason: "not-draft" as const };
    }
    if (row.outreachSentAt) {
      return { slug: row.slug, handle, name, send: false, reason: "sent" as const };
    }
    return { slug: row.slug, handle, name, send: true, reason: "unsent" as const };
  });
}

/** Drafts that still need the first Instagram message. */
export async function listUnsentOutreach(): Promise<OutreachCandidate[]> {
  await ensureTrainerDoorSchema();
  const rows = await getDb()
    .select({
      slug: trainerProfiles.slug,
      handle: trainerProfiles.instagramHandle,
      firstName: trainerProfiles.firstName,
      fullName: trainerProfiles.fullName,
      outreachSentAt: trainerProfiles.outreachSentAt,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.status, "draft"));
  return rows
    .filter((row) => row.handle.trim() && !row.outreachSentAt)
    .map((row) => ({
      slug: row.slug,
      handle: row.handle,
      name: row.fullName.trim() || row.firstName.trim() || row.slug,
    }));
}

/** Mark the first Instagram message sent and make the short link ready on both databases. */
export async function markOutreachSent(handle: string) {
  await ensureTrainerDoorSchema();
  const db = getDb();
  const needle = handle.trim().replace(/^@/, "");
  const [row] = await db
    .select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      handle: trainerProfiles.instagramHandle,
      status: trainerProfiles.status,
      outreachSentAt: trainerProfiles.outreachSentAt,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, needle))
    .limit(1);
  if (!row) return { ok: false as const, reason: "missing" as const };
  if (row.status !== "draft") return { ok: false as const, reason: "not-draft" as const };
  if (row.outreachSentAt) {
    await ensurePublicDoorLink(row.slug);
    return { ok: true as const, already: true as const };
  }
  const url = await ensurePublicDoorLink(row.slug);
  const sentAt = new Date();
  await db.update(trainerProfiles).set({ outreachSentAt: sentAt }).where(eq(trainerProfiles.id, row.id));
  const code = url.split("/hi/")[1] ?? "";
  const mirrored = await relayDoorMark({
    handle: row.handle || row.slug,
    token: code,
    outreachAt: sentAt.toISOString(),
  });
  if (!mirrored.ok) {
    await db.update(trainerProfiles).set({ outreachSentAt: null }).where(eq(trainerProfiles.id, row.id));
    return { ok: false as const, reason: "mirror" as const };
  }
  void writeLog({
    level: "info",
    domain: "admin",
    action: "admin.trainer_outreach",
    outcome: "success",
    message: "Первое сообщение в Instagram отмечено отправленным.",
    target: row.slug,
  });
  return { ok: true as const, already: false as const };
}
