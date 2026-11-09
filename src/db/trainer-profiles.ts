import { randomBytes } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";

import { formatBelarusPhone } from "@/lib/auth/phone";
import { logCaught, writeLog } from "@/lib/log/logger";
import { logTrainerPresence } from "@/lib/log/trainer-journal";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { inferTrainerGender, type TrainerGender } from "@/lib/catalog/trainer-gender";
import { instagramProfileSlug, trainerPersonKey } from "@/lib/catalog/trainer-slugs";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { isSpecificAddress, MAX_TRAINING_PLACES, placesFromProfile } from "@/lib/geo/schemas";
import { getDb } from "./index";
import { trainerProfiles, users, type TrainerPinnedPost, type TrainerSportRecord } from "./schema";

export type ImportedTrainerDraft = {
  handle: string;
  slug: string;
  sourceUrl: string;
  status?: "draft" | "published" | "hidden" | "archived";
  claimStatus?: "unclaimed" | "claimed" | "disputed";
  createdSource?: "self" | "branch_created" | "admin_created" | "import";
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: TrainerGender;
  headline: string;
  bio: string;
  sourceBio?: string;
  about?: string[];
  pinned?: TrainerPinnedPost[];
  sports?: TrainerSportRecord[];
  primarySport?: TrainerSportRecord | null;
  audiences?: Array<"adult" | "teen" | "kid">;
  formats?: Array<"individual" | "group">;
  city: string;
  citySlug?: string;
  district?: string;
  address?: string;
  priceFrom?: number | null;
  languages?: string[];
  avatarPath?: string;
  photos?: string[];
  certificates?: Array<{ path: string; caption: string }>;
  phone?: string;
  email?: string;
  telegram?: string;
  website?: string;
  instagramUrl?: string;
  experienceYears?: number;
};


export function claimPathFor(token: string) {
  return `/trainers/claim/${token}`;
}

function newClaimToken() {
  return randomBytes(32).toString("base64url");
}

/** A draft may list up to three halls separated by " | " or a new line. */
function addressLines(address: string): string[] {
  const parts = address.split(/\s*\|\s*|\n+/u).map((part) => part.trim()).filter(Boolean);
  const lines = parts.length > 0 ? parts : [address.trim()];
  return lines.slice(0, MAX_TRAINING_PLACES);
}

/**
 * Sync asks the same geocoder as the cabinet.
 * A matched street replaces the raw line. A venue name is not the stored address.
 * When the map does not answer, the raw line stays so a later save can try again.
 */
async function importedPlace(
  draft: ImportedTrainerDraft,
  existing: { trainingPlaces: unknown } | undefined,
  address: string,
) {
  const lines = addressLines(address);
  const pending = {
    trainingPlaces: lines.map((line) => ({
      city: draft.city,
      district: draft.district ?? "",
      address: line,
      lat: null,
      lng: null,
      geocodeStatus: "pending" as const,
    })),
    address: lines[0] ?? address,
    addressLat: null,
    addressLng: null,
    geocodeStatus: "pending" as const,
  };
  try {
    const resolved = await resolveTrainingPlaces(
      lines.map((line) => ({ city: draft.city, district: draft.district ?? "", address: line, lat: null, lng: null })),
      existing ? placesFromProfile(existing) : [],
    );
    const places = resolved.map((place, index) => ({
      ...place,
      city: draft.city.trim() || place.city,
      district: place.district || draft.district || "",
      address: place.geocodeStatus === "ok" && isSpecificAddress(place.address)
        ? place.address
        : (lines[index] || place.address),
    }));
    const mirror = mirrorTrainingPlace(places);
    return {
      trainingPlaces: places,
      address: mirror.address || lines[0] || address,
      addressLat: mirror.addressLat,
      addressLng: mirror.addressLng,
      geocodeStatus: mirror.geocodeStatus,
    };
  } catch (error) {
    logCaught("geo", "geo.profile", error);
    return pending;
  }
}

/** The face stays in the photo list. An empty import list must not wipe it. */
function profilePhotos(listed: string[] | undefined, avatarPath: string, existing: string[] | undefined) {
  const photos = (listed ?? []).map((item) => item.split("?")[0]).filter(Boolean);
  const avatar = avatarPath.split("?")[0];
  if (photos.length === 0) {
    if (avatar) return [avatar];
    return existing ?? [];
  }
  if (avatar && !photos.includes(avatar)) return [avatar, ...photos].slice(0, 9);
  return photos.slice(0, 9);
}

/** The slug that already belongs to this given name and surname, if it is not `slug`. */
export async function duplicateTrainerSlug(slug: string, firstName: string, lastName: string): Promise<string | null> {
  const key = trainerPersonKey(firstName, lastName);
  if (!key) return null;
  const self = instagramProfileSlug(slug);
  const rows = await getDb().select({
    slug: trainerProfiles.slug,
    handle: trainerProfiles.instagramHandle,
    firstName: trainerProfiles.firstName,
    lastName: trainerProfiles.lastName,
  }).from(trainerProfiles);
  for (const row of rows) {
    const other = instagramProfileSlug(row.handle || row.slug);
    if (other === self || row.slug === self) continue;
    if (trainerPersonKey(row.firstName, row.lastName) === key) return row.slug;
  }
  return null;
}

export async function upsertImportedTrainer(draft: ImportedTrainerDraft) {
  const db = getDb();
  const slug = instagramProfileSlug(draft.handle);
  if (!slug) throw new Error("Instagram nick is empty.");
  const [existing] = await db
    .select()
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, slug))
    .limit(1);
  const address = (draft.address ?? "").trim();
  const place = address ? await importedPlace(draft, existing, address) : {};
  const [taken] = await db
    .select({ id: trainerProfiles.id, handle: trainerProfiles.instagramHandle })
    .from(trainerProfiles)
    .where(existing
      ? and(eq(trainerProfiles.slug, slug), ne(trainerProfiles.id, existing.id))
      : eq(trainerProfiles.slug, slug))
    .limit(1);
  if (taken) throw new Error(`Nick ${slug} is already used by @${taken.handle}.`);
  const duplicate = await duplicateTrainerSlug(slug, draft.firstName, draft.lastName);
  if (duplicate) {
    void writeLog({
      level: "warn",
      domain: "catalog",
      action: "trainer.add",
      outcome: "denied",
      message: "Вторая карточка на того же человека не создана.",
      target: duplicate,
      subject: slug,
    });
    throw new Error(`This person already has slug ${duplicate}. Update that card. Do not create a second one.`);
  }

  if (existing?.ownerUserId) {
    const [owner] = await db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, existing.ownerUserId))
      .limit(1);
    if (owner?.status === "deleted") {
      void writeLog({
        level: "info",
        domain: "catalog",
        action: "trainer.sync",
        outcome: "skipped",
        message: "Карточка не обновлялась: аккаунт удалён.",
        target: slug,
      });
      return { id: existing.id, claimPath: existing.claimPath, created: false as const };
    }
  }

  const claimToken = existing?.claimToken ?? newClaimToken();
  const claimPath = existing?.claimPath ?? claimPathFor(claimToken);
  const values = {
    slug,
    instagramHandle: slug,
    sourceUrl: draft.sourceUrl,
    status: draft.status ?? "draft",
    claimStatus: existing?.claimStatus === "claimed" ? "claimed" : (draft.claimStatus ?? "unclaimed"),
    createdSource: draft.createdSource ?? "import",
    firstName: draft.firstName,
    lastName: draft.lastName,
    fullName: draft.fullName,
    gender: draft.gender === "male" || draft.gender === "female"
      ? draft.gender
      : inferTrainerGender(draft.firstName, `${draft.bio}\n${draft.fullName}`),
    headline: draft.headline,
    bio: draft.bio,
    sourceBio: draft.sourceBio ?? draft.bio,
    about: draft.about ?? [],
    pinnedPosts: draft.pinned ?? [],
    sports: draft.sports ?? [],
    primarySport: draft.primarySport ?? null,
    audiences: draft.audiences?.length ? draft.audiences : ["adult"],
    formats: draft.formats ?? [],
    city: draft.city,
    citySlug: draft.citySlug || cityCatalogSlug(draft.city) || "",
    district: draft.district ?? "",
    ...place,
    priceFrom: draft.priceFrom ?? null,
    languages: draft.languages ?? [],
    avatarPath: draft.avatarPath ?? "",
    photos: profilePhotos(draft.photos, draft.avatarPath ?? "", existing?.photos),
    certificates: draft.certificates ?? existing?.certificates ?? [],
    phone: formatBelarusPhone(draft.phone ?? ""),
    email: draft.email ?? "",
    website: draft.website ?? "",
    telegram: draft.telegram ?? "",
    instagramUrl: draft.instagramUrl || draft.sourceUrl,
    experienceYears: draft.experienceYears ?? 0,
    claimToken,
    claimPath,
    updatedAt: new Date(),
  } as const;

  if (existing) {
    await db.update(trainerProfiles).set(values).where(eq(trainerProfiles.id, existing.id));
    logTrainerPresence({
      created: false,
      previous: existing.status,
      next: values.status,
      slug,
      source: values.createdSource,
      mode: "import",
    });
    return { id: existing.id, claimPath, created: false };
  }

  const [created] = await db
    .insert(trainerProfiles)
    .values(values)
    .returning({ id: trainerProfiles.id, claimPath: trainerProfiles.claimPath });
  logTrainerPresence({
    created: true,
    previous: null,
    next: values.status,
    slug,
    source: values.createdSource,
    mode: "import",
  });
  return { id: created.id, claimPath: created.claimPath, created: true };
}
