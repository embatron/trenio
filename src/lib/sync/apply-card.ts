import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { claimPathFor } from "@/db/trainer-profiles";
import { trainerProfiles } from "@/db/schema";
import { ensureTrainerDoorSchema } from "@/lib/catalog/trainer-door-schema";
import { logTrainerPresence } from "@/lib/log/trainer-journal";
import { writeLog } from "@/lib/log/logger";

import { cleanHandle, looksLikeMedia, nextStamp, trainerFileName } from "./policy";
import {
  incomingCardWins,
  isTrainerStatus,
  mergedStatus,
  parseTrainerCard,
  trainerRevision,
  type TrainerCardBody,
  type TrainerStatus,
  type TrainerSyncHead,
} from "./trainers";

const FILE_CAP = 2_500_000;
const TOTAL_CAP = 24_000_000;

type IncomingFile = { name?: unknown; data?: unknown };
type Tie = "existing" | "incoming";

export type TrainerPatch = {
  handle: string;
  status: TrainerStatus;
  updatedAt: string;
  outreachSentAt: string | null;
  inviteSentAt: string | null;
  doorEnteredAt: string | null;
  card: TrainerCardBody | null;
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mediaRoots() {
  const roots = [path.resolve("public/trainers/instagram")];
  if (existsSync(path.resolve("dist/client"))) roots.push(path.resolve("dist/client/trainers/instagram"));
  return roots;
}

function filesFor(handle: string) {
  const dir = path.resolve("public/trainers/instagram");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => trainerFileName(handle, name))
    .map((name) => ({ name, data: readFileSync(path.join(dir, name)).toString("base64") }));
}

function cardFromRow(row: typeof trainerProfiles.$inferSelect): TrainerCardBody {
  return parseTrainerCard({
    slug: row.slug,
    sourceUrl: row.sourceUrl,
    claimStatus: row.claimStatus,
    createdSource: row.createdSource,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    gender: row.gender,
    headline: row.headline,
    bio: row.bio,
    sourceBio: row.sourceBio,
    about: row.about,
    pinnedPosts: row.pinnedPosts,
    sports: row.sports,
    primarySport: row.primarySport,
    audiences: row.audiences,
    formats: row.formats,
    city: row.city,
    citySlug: row.citySlug,
    district: row.district,
    trainingPlaces: row.trainingPlaces,
    address: row.address,
    addressLat: row.addressLat,
    addressLng: row.addressLng,
    geocodeStatus: row.geocodeStatus,
    priceFrom: row.priceFrom,
    languages: row.languages,
    avatarPath: row.avatarPath,
    photos: row.photos,
    certificates: row.certificates,
    phone: row.phone,
    email: row.email,
    website: row.website,
    instagramUrl: row.instagramUrl,
    telegram: row.telegram,
    experienceYears: row.experienceYears,
  }) as TrainerCardBody;
}

function headFrom(handle: string, row: typeof trainerProfiles.$inferSelect): TrainerSyncHead {
  const card = cardFromRow(row);
  return {
    handle,
    status: row.status,
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
    outreachSentAt: iso(row.outreachSentAt),
    inviteSentAt: iso(row.inviteSentAt),
    doorEnteredAt: iso(row.doorEnteredAt),
    revision: trainerRevision(card),
  };
}

export async function listTrainerSyncHeads() {
  await ensureTrainerDoorSchema();
  const rows = await getDb().select().from(trainerProfiles);
  return rows.flatMap((row) => {
    const handle = cleanHandle(row.instagramHandle);
    if (!handle) return [];
    return [headFrom(handle, row)];
  });
}

export async function readTrainerSync(handle: string) {
  await ensureTrainerDoorSchema();
  const clean = cleanHandle(handle);
  if (!clean) return null;
  const [row] = await getDb()
    .select()
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, clean))
    .limit(1);
  if (!row) return null;
  return { head: headFrom(clean, row), card: cardFromRow(row), files: filesFor(clean) };
}

function storeFiles(handle: string, files: IncomingFile[]) {
  if (files.length > 40) return { ok: false as const, reason: "files" as const };
  let total = 0;
  const written: Array<{ name: string; bytes: Buffer }> = [];
  for (const file of files) {
    const name = typeof file.name === "string" ? file.name : "";
    const data = typeof file.data === "string" ? file.data : "";
    if (!name) continue;
    if (!trainerFileName(handle, name)) return { ok: false as const, reason: "name" as const };
    const bytes = Buffer.from(data, "base64");
    if (!bytes.length || bytes.length > FILE_CAP || !looksLikeMedia(name, bytes)) {
      return { ok: false as const, reason: "file" as const };
    }
    total += bytes.length;
    if (total > TOTAL_CAP) return { ok: false as const, reason: "size" as const };
    written.push({ name, bytes });
  }
  for (const root of mediaRoots()) {
    mkdirSync(root, { recursive: true });
    for (const file of written) {
      const target = path.resolve(root, file.name);
      if (!target.startsWith(root + path.sep)) return { ok: false as const, reason: "name" as const };
      writeFileSync(target, file.bytes);
    }
  }
  return { ok: true as const, count: written.length };
}

function contentValues(card: TrainerCardBody) {
  return {
    slug: card.slug,
    sourceUrl: card.sourceUrl,
    claimStatus: card.claimStatus,
    createdSource: card.createdSource,
    firstName: card.firstName,
    lastName: card.lastName,
    fullName: card.fullName,
    gender: card.gender,
    headline: card.headline,
    bio: card.bio,
    sourceBio: card.sourceBio,
    about: card.about,
    pinnedPosts: card.pinnedPosts,
    sports: card.sports as typeof trainerProfiles.$inferInsert.sports,
    primarySport: card.primarySport as typeof trainerProfiles.$inferInsert.primarySport,
    audiences: card.audiences as typeof trainerProfiles.$inferInsert.audiences,
    formats: card.formats as typeof trainerProfiles.$inferInsert.formats,
    city: card.city,
    citySlug: card.citySlug,
    district: card.district,
    trainingPlaces: card.trainingPlaces as typeof trainerProfiles.$inferInsert.trainingPlaces,
    address: card.address,
    addressLat: card.addressLat,
    addressLng: card.addressLng,
    geocodeStatus: card.geocodeStatus,
    priceFrom: card.priceFrom == null ? null : Math.round(card.priceFrom),
    languages: card.languages,
    avatarPath: card.avatarPath,
    photos: card.photos,
    certificates: card.certificates as typeof trainerProfiles.$inferInsert.certificates,
    phone: card.phone,
    email: card.email,
    website: card.website,
    instagramUrl: card.instagramUrl,
    telegram: card.telegram,
    experienceYears: card.experienceYears,
  };
}

/** A visit is written by opening `/hi/{code}` on this host. Production does not take one from a sync. */
function acceptSyncedDoor() {
  return process.env.NODE_ENV !== "production";
}

export async function applyTrainerPatch(patch: TrainerPatch, files: IncomingFile[], tie: Tie) {
  await ensureTrainerDoorSchema();
  const handle = cleanHandle(patch.handle);
  if (!handle || !isTrainerStatus(patch.status) || !iso(patch.updatedAt)) {
    return { ok: false as const, reason: "card" as const };
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, handle))
    .limit(1);

  if (!existing) {
    if (!patch.card) return { ok: false as const, reason: "missing" as const };
    const stored = storeFiles(handle, files);
    if (!stored.ok) return stored;
    const [taken] = await db
      .select({ id: trainerProfiles.id })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, patch.card.slug))
      .limit(1);
    const slug = taken ? handle : patch.card.slug;
    const claimToken = randomBytes(32).toString("base64url");
    await db.insert(trainerProfiles).values({
      ...contentValues({ ...patch.card, slug }),
      instagramHandle: handle,
      status: patch.status,
      claimToken,
      claimPath: claimPathFor(claimToken),
      outreachSentAt: iso(patch.outreachSentAt) ? new Date(patch.outreachSentAt as string) : null,
      inviteSentAt: iso(patch.inviteSentAt) ? new Date(patch.inviteSentAt as string) : null,
      doorEnteredAt: acceptSyncedDoor() && iso(patch.doorEnteredAt) ? new Date(patch.doorEnteredAt as string) : null,
      updatedAt: new Date(patch.updatedAt),
    });
    logTrainerPresence({
      created: true,
      previous: null,
      next: patch.status,
      slug,
      source: patch.card.createdSource,
      mode: "import",
    });
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.sync_trainers",
      outcome: "success",
      message: "Карточка тренера синхронизирована.",
      target: handle,
      context: { created: true },
    });
    return { ok: true as const, created: true, card: true, status: true, marks: true };
  }

  const current = headFrom(handle, existing);
  const nextStatus = mergedStatus(existing.status, patch.status, current.updatedAt, patch.updatedAt, tie);
  const outreach = nextStamp(existing.outreachSentAt, patch.outreachSentAt);
  const invite = nextStamp(existing.inviteSentAt, patch.inviteSentAt);
  const door = acceptSyncedDoor() ? nextStamp(existing.doorEnteredAt, patch.doorEnteredAt) : null;
  const writeCard = Boolean(patch.card)
    && trainerRevision(patch.card as TrainerCardBody) !== current.revision
    && incomingCardWins(current.updatedAt, patch.updatedAt, tie);

  if (writeCard) {
    const stored = storeFiles(handle, files);
    if (!stored.ok) return stored;
  }

  const values: Partial<typeof trainerProfiles.$inferInsert> = {};
  if (writeCard && patch.card) {
    const card = contentValues(patch.card);
    if (card.slug !== existing.slug) {
      const [taken] = await db
        .select({ id: trainerProfiles.id })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, card.slug))
        .limit(1);
      if (taken && taken.id !== existing.id) card.slug = existing.slug;
    }
    Object.assign(values, card, { updatedAt: new Date(patch.updatedAt) });
  }
  if (nextStatus !== existing.status) values.status = nextStatus;
  if (outreach) values.outreachSentAt = outreach;
  if (invite) values.inviteSentAt = invite;
  if (door) values.doorEnteredAt = door;

  if (Object.keys(values).length > 0) {
    await db.update(trainerProfiles).set(values).where(eq(trainerProfiles.id, existing.id));
    if (values.status && values.status !== existing.status) {
      logTrainerPresence({
        created: false,
        previous: existing.status,
        next: values.status,
        slug: existing.slug,
        source: existing.createdSource,
        mode: "save",
      });
    }
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.sync_trainers",
      outcome: "success",
      message: "Карточка тренера синхронизирована.",
      target: handle,
      context: { created: false, card: writeCard, status: nextStatus !== existing.status },
    });
  }
  return {
    ok: true as const,
    created: false,
    card: writeCard,
    status: nextStatus !== existing.status,
    marks: Boolean(outreach || invite || door),
  };
}

export function parseTrainerPatch(value: unknown): TrainerPatch | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const handle = cleanHandle(typeof row.handle === "string" ? row.handle : "");
  if (!handle || !isTrainerStatus(row.status) || !iso(typeof row.updatedAt === "string" ? row.updatedAt : null)) return null;
  const card = row.card == null ? null : parseTrainerCard(row.card);
  if (row.card != null && !card) return null;
  return {
    handle,
    status: row.status,
    updatedAt: iso(row.updatedAt as string) as string,
    outreachSentAt: iso(typeof row.outreachSentAt === "string" ? row.outreachSentAt : null),
    inviteSentAt: iso(typeof row.inviteSentAt === "string" ? row.inviteSentAt : null),
    doorEnteredAt: iso(typeof row.doorEnteredAt === "string" ? row.doorEnteredAt : null),
    card,
  };
}
