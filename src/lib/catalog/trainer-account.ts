import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { ensureAuthSchema } from "@/auth/auth-schema";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { claimPathFor } from "@/db/trainer-profiles";
import { prepareCertificateUpload, storeCertificatePreviews } from "@/lib/catalog/certificate-preview.server";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { parseTrainerSignupDraft, type TrainerSignupDraft } from "@/lib/catalog/trainer-signup-draft";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { writeImageSet } from "@/lib/images/store";
import { logCaught } from "@/lib/log/logger";
import { logTrainerPresence } from "@/lib/log/trainer-journal";

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function nameSlug(value: string) {
  const latin = value.toLowerCase().split("").map((char) => CYR[char] ?? char).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18).replace(/-+$/g, "") || "trainer";
}

function selfHandle(userId: string) {
  return `self${userId.replace(/-/g, "").slice(0, 12)}`;
}

type ManualTrainer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

const CERTIFICATE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

function cardFromDraft(draft: TrainerSignupDraft | null) {
  if (!draft) return {};
  return {
    headline: draft.headline,
    bio: draft.bio,
    about: draft.about ? [draft.about] : [],
    sports: draft.sports,
    primarySport: draft.sports[0] ?? null,
    city: draft.city,
    citySlug: nameSlug(draft.city),
    formats: draft.formats,
    audiences: draft.audiences,
    priceFrom: draft.priceFrom,
    experienceYears: draft.experienceYears,
    phone: draft.phone,
    instagramUrl: draft.instagram,
    telegram: draft.telegram,
  };
}

async function storeSignupPhoto(userId: string, image: string): Promise<string | null> {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(image);
  if (!match) return null;
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > 1_500_000) return null;
  const relative = `/trainers/self/${userId}/${Date.now()}-${randomBytes(3).toString("hex")}.jpg`;
  await writeImageSet(buffer, path.join(process.cwd(), "public", relative), "attention", "later");
  return relative;
}

async function storeSignupCertificate(userId: string, fileName: string, dataUrl: string): Promise<string | null> {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const fromName = fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  const named = fromName === "jpeg" ? "jpg" : fromName;
  const ext = CERTIFICATE_TYPES[mime] ?? (named && Object.values(CERTIFICATE_TYPES).includes(named) ? named : "");
  if (!ext) return null;
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > 8_000_000) return null;
  const prepared = await prepareCertificateUpload(buffer, ext);
  const dir = path.join(process.cwd(), "public", "trainers", "self", userId, "certificates");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(3).toString("hex")}.${prepared.ext}`;
  const stored = `/trainers/self/${userId}/certificates/${name}`;
  await writeFile(path.join(dir, name), prepared.bytes);
  try {
    await storeCertificatePreviews(stored);
  } catch (error) {
    logCaught("catalog", "catalog.certificate.preview", error, { target: stored });
  }
  return stored;
}

async function storedSignupDraft(userId: string): Promise<TrainerSignupDraft | null> {
  const db = getDb();
  const [row] = await db
    .select({ draft: users.trainerSignupDraft })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return parseTrainerSignupDraft(row?.draft);
}

/** Trainer role and an owned draft for a person who registered without Instagram. */
export async function openManualTrainerAccount(
  user: ManualTrainer,
  basics?: TrainerSignupDraft | null,
): Promise<void> {
  await ensureAuthSchema();
  const db = getDb();
  const draft = basics ?? await storedSignupDraft(user.id);
  const card = cardFromDraft(draft);
  const media = await mediaFromDraft(user.id, draft);
  const [owned] = await db
    .select({ id: trainerProfiles.id, createdSource: trainerProfiles.createdSource })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, user.id))
    .limit(1);
  if (!owned) {
    const firstName = user.firstName.trim() || "Тренер";
    const lastName = (user.lastName ?? "").trim();
    const handle = selfHandle(user.id);
    const base = nameSlug(joinTrainerName(firstName, lastName));
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      slug = attempt === 0 ? base : `${base.slice(0, 15)}-${attempt + 1}`.slice(0, 18);
      const [clash] = await db
        .select({ id: trainerProfiles.id })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, slug))
        .limit(1);
      if (!clash) break;
    }
    const claimToken = randomBytes(32).toString("base64url");
    const now = new Date();
    await db.insert(trainerProfiles).values({
      slug,
      instagramHandle: handle,
      sourceUrl: "https://trenio.by/join/account",
      status: "draft",
      claimStatus: "claimed",
      createdSource: "self",
      ownerUserId: user.id,
      firstName,
      lastName: lastName || "",
      fullName: joinTrainerName(firstName, lastName),
      claimToken,
      claimPath: claimPathFor(claimToken),
      claimedAt: now,
      privacyAcceptedAt: now,
      email: user.email,
      emailVerifiedAt: now,
      ...card,
      ...media,
    });
    logTrainerPresence({
      created: true,
      previous: null,
      next: "draft",
      slug,
      actorUserId: user.id,
      subject: user.email,
      source: "self",
      mode: "save",
    });
    const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
    await sendTrainerWelcome({ id: user.id, firstName });
  } else if (draft && owned.createdSource === "self") {
    await db.update(trainerProfiles).set({
      ...card,
      ...media,
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, owned.id));
  }
  await db.insert(userRoles).values({ userId: user.id, role: "trainer" }).onConflictDoNothing();
  if (draft) {
    await db.update(users).set({
      trainerSignupDraft: null,
      ...(media.avatarPath ? { avatarPath: media.avatarPath } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
  }
}

async function mediaFromDraft(userId: string, draft: TrainerSignupDraft | null) {
  if (!draft) return { avatarPath: "" };
  let places = draft.places;
  try {
    places = await resolveTrainingPlaces(draft.places, []);
  } catch (error) {
    logCaught("geo", "geo.profile", error, { actorUserId: userId });
  }
  const mirror = mirrorTrainingPlace(places);
  const photos: string[] = [];
  for (const image of draft.photos) {
    try {
      const stored = await storeSignupPhoto(userId, image);
      if (stored) photos.push(stored);
    } catch (error) {
      logCaught("catalog", "catalog.photo", error, { actorUserId: userId });
    }
  }
  const certificates: Array<{ path: string; caption: string }> = [];
  for (const item of draft.certificates) {
    try {
      const stored = await storeSignupCertificate(userId, item.fileName, item.dataUrl);
      if (stored) certificates.push({ path: stored, caption: item.caption });
    } catch (error) {
      logCaught("catalog", "catalog.certificate", error, { actorUserId: userId });
    }
  }
  return {
    district: places[0]?.district ?? "",
    trainingPlaces: places,
    address: mirror.address,
    addressLat: mirror.addressLat,
    addressLng: mirror.addressLng,
    geocodeStatus: mirror.geocodeStatus,
    photos,
    avatarPath: photos[0] ?? "",
    certificates,
  };
}

export async function openManualTrainerAccountSafely(user: ManualTrainer): Promise<void> {
  try {
    await openManualTrainerAccount(user);
  } catch (error) {
    logCaught("account", "account.claim", error, { subject: user.email, actorUserId: user.id });
  }
}
