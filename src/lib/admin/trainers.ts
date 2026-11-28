import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { markLogged, writeLog, logCaught } from "@/lib/log/logger";
import { logTrainerPresence } from "@/lib/log/trainer-journal";
import { sendProfileStatusNotice } from "@/lib/mail/account-notices";
import { listActorJournal, mergeJournal } from "@/lib/log/journal";
import { normalizeEmail } from "@/auth/password";
import { confirmAccountPhoneCode, requestAccountPhoneCode } from "@/auth/service";
import { getDb } from "@/db";
import {
  authOtpChallenges,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  trainerProfiles,
  trainerReviews,
  userRoles,
  users,
  type TrainerSportRecord,
} from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { AuthError } from "@/lib/auth/errors";
import { formatBelarusPhone, validateBelarusMobile } from "@/lib/auth/phone";
import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { CERTIFICATE_CAPTION_MAX, MAX_TRAINER_CERTIFICATES, readCertificates, type TrainerCertificate } from "@/lib/catalog/certificate-file";
import { editorHtml, reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import { removeImageSet, writeImageSet } from "@/lib/images/store";
import { effectiveAudiences, getPublishedTrainer, PUBLISHED_TRAINERS, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { joinTrainerName, trainerNameParts } from "@/lib/catalog/trainer-name";
import { ensureTrainerDoorSchema } from "@/lib/catalog/trainer-door-schema";
import { publishMessage, verificationClearedMessage, verificationMessage } from "@/lib/catalog/trainer-verify-log";
import { outreachTemplate } from "@/lib/site-texts/defaults";
import { loadSiteText } from "@/lib/site-texts/store";
import { cabinetInstagram } from "@/lib/catalog/trainer-contact-cross";
import { canonicalThreadsUrl } from "@/lib/catalog/threads-url";
import { popularityChecklist, popularityScore, recentReviewStart } from "@/lib/catalog/trainer-popularity";
import { trainerAccountReady } from "@/lib/catalog/trainer-verified";
import { emptyTrainerInterest, loadTrainerInterest, type TrainerInterest } from "@/lib/catalog/trainer-interest";
import type { TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { blankTrainerPulse, loadProfilePulse } from "@/lib/catalog/trainer-views.server";
import type { TrainerCabinetPulse } from "@/lib/catalog/trainer-views";
import { ensureTrainerPublishedAt, stampTrainerPublished } from "@/lib/catalog/trainer-published";
import { listTrainerRevisionViews, stampTrainerRevision, type TrainerRevisionView } from "@/lib/catalog/trainer-revision";
import { getSportTaxonomyChild, getTopLevelSportCategory, listSecondLevelSports, MAX_TRAINER_SPORTS, trainerSectionBySlug, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { placesFromProfile, placesShape, savedWithMapNotice, type TrainerPlace } from "@/lib/geo/schemas";

export const TRAINER_PUBLISH_STATUSES = ["draft", "published", "hidden", "archived", "declined"] as const;
export type TrainerPublishStatus = (typeof TRAINER_PUBLISH_STATUSES)[number];

export const TRAINER_PAGE_STATUSES = ["published", "hidden", "archived"] as const;
export const TRAINER_STAFF_STATUSES = ["draft", "declined"] as const;

/** A staff publish of an unclear card keeps that queue. Confirmation or another page status clears it. */
export function keptUnclearHold(input: {
  previousStatus: string;
  previousDoor: Date | null;
  previousHold: boolean;
  nextStatus: string;
  ready: boolean;
}) {
  if (input.ready || input.nextStatus !== "published") return false;
  const wasUnclear = input.previousStatus === "draft" && input.previousDoor != null;
  return wasUnclear || input.previousHold;
}

/** No short-link visit yet. The card is still a draft. */
export function isDraftQueue(trainer: { status: string; doorEnteredAt: string }) {
  return trainer.status === "draft" && !trainer.doorEnteredAt;
}

/** Published, and the owner has confirmed the account. */
export function isActiveTrainer(trainer: { status: string; trusted: boolean }) {
  return trainer.status === "published" && trainer.trusted;
}

/** A visit happened and the account is still unconfirmed. Staff may already have published it. A refusal is its own list. */
export function staysUnclear(trainer: {
  status: string;
  doorEnteredAt: string;
  trusted: boolean;
}) {
  if (trainer.status === "declined") return false;
  return !trainer.trusted && Boolean(trainer.doorEnteredAt);
}

export const TRAINER_PUBLISH_LABEL: Record<TrainerPublishStatus, string> = {
  draft: "На модерации",
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "Снята с публикации",
  declined: "Отказались",
};

function trainerCardPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const formatted = formatBelarusPhone(trimmed);
  if (!formatted) throw new AuthError(validateBelarusMobile(trimmed) || "Укажите мобильный номер РБ: +375 25/29/33/44 …", "VALIDATION");
  return formatted;
}

export type AdminTrainerAccount = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  phone: string;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  status: string;
  roles: UserRole[];
};

export type AdminTrainer = {
  id: string | null;
  slug: string;
  status: TrainerPublishStatus;
  verified: boolean;
  /** Green seal: verified and a confirmed mailbox or Belarus mobile. */
  trusted: boolean;
  /** The owner agreed to publish while the account was still unconfirmed. */
  publishAsked: boolean;
  /** Staff published this unclear card. It stays on that list. */
  unclearHold: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  bio: string;
  about: string;
  sports: string;
  sportSlugs: string[];
  city: string;
  district: string;
  places: TrainerPlace[];
  priceFrom: number | null;
  languages: string;
  phone: string;
  instagram: string;
  instagramHandle: string;
  telegram: string;
  threads: string;
  email: string;
  experienceYears: number;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
  avatarPath: string;
  createdAt: string;
  /** First time the card entered the catalog. Empty until it is published. */
  publishedAt: string;
  reviews: number;
  rating: string;
  popularity: number;
  catalog: boolean;
  account: AdminTrainerAccount | null;
  offerAccepted: boolean;
  /** When the first Instagram message was sent. Empty until then. */
  outreachSentAt: string;
  /** When staff copied the short link. Empty until that click. */
  inviteSentAt: string;
  /** First open of the short link. Empty until that visit. */
  doorEnteredAt: string;
  /** Latest open of the short link. Empty until that visit. */
  doorSeenAt: string;
  /** Last time the owner signed in. Empty when the card has no account or they have not signed in. */
  lastLoginAt: string;
};

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value: string, max = 18) {
  const latin = value.toLowerCase().split("").map((char) => CYR[char] ?? char).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}

const childSlugByLabel = new Map(listSecondLevelSports().map((sport) => [sport.label.toLowerCase(), sport.slug]));

function sportSelection(records: Array<{ slug: string; label: string }>) {
  const slugs: string[] = [];
  for (const sport of records) {
    const slug = getSportTaxonomyChild(sport.slug)?.slug
      ?? trainerSectionBySlug(sport.slug)?.slug
      ?? childSlugByLabel.get(sport.label.toLowerCase());
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return {
    sportSlugs: slugs,
    sports: slugs.map((slug) => getSportTaxonomyChild(slug)?.label ?? getTopLevelSportCategory(slug)?.label ?? slug).join(", "),
  };
}

function decodeJpeg(image: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(image);
  if (!match) throw new AuthError("Фото должно быть изображением JPEG, PNG или WebP.", "VALIDATION");
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buffer.length > 1_500_000) throw new AuthError("Фото больше 1,5 МБ.", "VALIDATION");
  return buffer;
}

export { MAX_TRAINER_CERTIFICATES };

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

function decodeCertificate(dataUrl: string, fileName: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new AuthError("Файл не прочитан.", "VALIDATION");
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const fromName = fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  const named = fromName === "jpeg" ? "jpg" : fromName;
  const ext = CERTIFICATE_TYPES[mime] ?? (named && Object.values(CERTIFICATE_TYPES).includes(named) ? named : "");
  if (!ext) throw new AuthError("Можно загрузить PNG, JPG, PDF и другие документы.", "VALIDATION");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > 8_000_000) throw new AuthError("Файл больше 8 МБ.", "VALIDATION");
  return { buffer, ext };
}

async function editableTrainer(slug: string, user: { id: string; roles: UserRole[] }) {
  const [row] = await getDb().select().from(trainerProfiles).where(eq(trainerProfiles.slug, slug)).limit(1);
  if (!row) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
  if (!isStaff(user.roles) && row.ownerUserId !== user.id) {
    throw new AuthError("Эту карточку нельзя изменить.", "FORBIDDEN");
  }
  return row;
}

async function writeTrainerFile(slug: string, folder: string, fileName: string, dataUrl: string) {
  const decoded = decodeCertificate(dataUrl, fileName);
  const { prepareCertificateUpload, storeCertificatePreviews } = await import("@/lib/catalog/certificate-preview.server");
  const prepared = await prepareCertificateUpload(decoded.buffer, decoded.ext);
  const dir = path.join(process.cwd(), "public", "trainers", "admin", slug, folder);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(3).toString("hex")}.${prepared.ext}`;
  const stored = `/trainers/admin/${slug}/${folder}/${name}`;
  await writeFile(path.join(dir, name), prepared.bytes);
  try {
    await storeCertificatePreviews(stored);
  } catch (error) {
    const { logCaught } = await import("@/lib/log/logger");
    logCaught("catalog", "catalog.certificate.preview", error, { target: stored });
  }
  return stored;
}

async function writeTrainerImage(slug: string, folder: string, image: string) {
  const buffer = decodeJpeg(image);
  const dir = path.join(process.cwd(), "public", "trainers", "admin", slug, folder);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(3).toString("hex")}.jpg`;
  await writeImageSet(buffer, path.join(dir, name));
  return `/trainers/admin/${slug}/${folder}/${name}`;
}

async function removeTrainerFile(_slug: string, stored: string) {
  const clean = stored.split("?")[0];
  if (!clean.startsWith("/trainers/") || clean.includes("..")) return;
  const absolute = path.join(process.cwd(), "public", clean);
  const base = absolute.replace(/\.[a-z0-9]+$/i, "");
  await Promise.all([
    unlink(`${base}-doc-thumb.jpg`).catch(() => undefined),
    unlink(`${base}-doc-view.jpg`).catch(() => undefined),
  ]);
  if (!clean.startsWith("/trainers/admin/")) return;
  await removeImageSet(absolute);
}

function storedAbout(value: string) {
  const html = sanitizeReviewHtml(value);
  return reviewPlainText(html) ? [html] : [];
}

async function syncOwnerAvatar(ownerUserId: string | null, photo: string) {
  if (!ownerUserId) return;
  await getDb().update(users).set({
    avatarPath: photo.split("?")[0],
    updatedAt: new Date(),
  }).where(eq(users.id, ownerUserId));
}

function versioned(items: string[]) {
  const version = Date.now();
  return items.map((item) => `${item.split("?")[0]}?v=${version}`);
}

function versionedCertificates(items: TrainerCertificate[]) {
  const version = Date.now();
  return items.map((item) => ({ ...item, path: `${item.path.split("?")[0]}?v=${version}` }));
}

function handleFrom(raw: string, fallback: string) {
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl || raw.replace(/^@/, "")).replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  return handle || fallback.replace(/[^a-z0-9._]/gi, "").slice(0, 30);
}

export const MAX_TRAINER_PHOTOS = 9;

const saveSchema = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().trim().min(1).max(30),
  status: z.enum(TRAINER_PUBLISH_STATUSES),
  verified: z.boolean(),
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().max(100),
  headline: z.string().trim().max(200),
  bio: z.string().trim().max(4000),
  about: z.string().trim().max(8000),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  district: z.string().trim().max(120),
  ...placesShape,
  priceFrom: z.number().int().min(1).max(1_000_000).nullable(),
  phone: z.string().trim().max(32),
  instagram: z.string().trim().max(300),
  telegram: z.string().trim().max(300),
  threads: z.string().trim().max(300),
  email: z.string().trim().max(320),
  experienceYears: z.number().int().min(0).max(80),
  formats: z.array(z.enum(["individual", "group"])).max(2),
  audiences: z.array(z.enum(["adult", "teen", "kid"])).max(3),
});

function trainerStats(
  slug: string,
  ratings: Map<string, { reviews: number; positiveReviews: number; recentPositiveReviews: number; average: number }>,
  interest: Record<string, TrainerInterest>,
  fill: { card: number; contacts: number },
  accountReady = false,
) {
  const row = ratings.get(slug);
  const reviews = row?.reviews ?? 0;
  const positiveReviews = row?.positiveReviews ?? 0;
  const recentPositiveReviews = row?.recentPositiveReviews ?? 0;
  const average = row?.average ?? 0;
  const rating = reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : "0";
  const signal = interest[slug] ?? emptyTrainerInterest;
  return {
    reviews,
    rating,
    popularity: popularityScore({
      rating,
      reviews,
      positiveReviews,
      recentPositiveReviews,
      ...signal,
      cardFilled: fill.card,
      contactsFilled: fill.contacts,
      verified: accountReady,
    }),
  };
}

function isCatalog(slug: string) {
  return PUBLISHED_TRAINERS.some((trainer) => trainer.slug === slug);
}

/** First catalog appearance, keyed by slug. Empty when the column cannot be read. */
async function loadPublishedAt() {
  if (!(await ensureTrainerPublishedAt())) return new Map<string, string>();
  const rows = await getDb().execute(sql`
    SELECT slug, published_at
    FROM trainer_profiles
    WHERE published_at IS NOT NULL
  `);
  const ages = new Map<string, string>();
  for (const row of rows) {
    const slug = String(row.slug ?? "");
    const raw = row.published_at;
    if (!slug || raw == null || raw === "") continue;
    const date = raw instanceof Date ? raw : new Date(String(raw));
    if (Number.isNaN(date.getTime())) continue;
    ages.set(slug, date.toISOString());
  }
  return ages;
}

export const getAdminTrainersFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<{ trainers: AdminTrainer[]; outreachText: string }> => {
    assertStaff(context.user.roles);
    await ensureTrainerDoorSchema();
    const db = getDb();
    const publishedAtBySlug = await loadPublishedAt();
    const recentSince = recentReviewStart();
    const [profileRows, ratingRows, interest] = await Promise.all([
      db
      .select({
        id: trainerProfiles.id,
        slug: trainerProfiles.slug,
        status: trainerProfiles.status,
        verified: trainerProfiles.verified,
        publishRequestedAt: trainerProfiles.publishRequestedAt,
        unclearHold: trainerProfiles.unclearHold,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        headline: trainerProfiles.headline,
        bio: trainerProfiles.bio,
        about: trainerProfiles.about,
        sports: trainerProfiles.sports,
        city: trainerProfiles.city,
        district: trainerProfiles.district,
        trainingPlaces: trainerProfiles.trainingPlaces,
        address: trainerProfiles.address,
        addressLat: trainerProfiles.addressLat,
        addressLng: trainerProfiles.addressLng,
        geocodeStatus: trainerProfiles.geocodeStatus,
        priceFrom: trainerProfiles.priceFrom,
        languages: trainerProfiles.languages,
        phone: trainerProfiles.phone,
        contactEmail: trainerProfiles.email,
        instagramUrl: trainerProfiles.instagramUrl,
        telegram: trainerProfiles.telegram,
        threads: trainerProfiles.threads,
        experienceYears: trainerProfiles.experienceYears,
        formats: trainerProfiles.formats,
        audiences: trainerProfiles.audiences,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
        certificates: trainerProfiles.certificates,
        instagramHandle: trainerProfiles.instagramHandle,
        createdSource: trainerProfiles.createdSource,
        createdAt: trainerProfiles.createdAt,
        offerAcceptedAt: trainerProfiles.offerAcceptedAt,
        outreachSentAt: trainerProfiles.outreachSentAt,
        inviteSentAt: trainerProfiles.inviteSentAt,
        doorEnteredAt: trainerProfiles.doorEnteredAt,
        doorSeenAt: trainerProfiles.doorSeenAt,
        ownerId: users.id,
        email: users.email,
        accountEmailVerifiedAt: users.emailVerifiedAt,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        accountPhone: users.phone,
        accountPhoneVerifiedAt: users.phoneVerifiedAt,
        accountStatus: users.status,
        lastLoginAt: users.lastLoginAt,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId)),
      db
        .select({
          slug: trainerReviews.trainerSlug,
          reviews: count(),
          positiveReviews: sql<number>`count(*) filter (where ${trainerReviews.rating} >= 4)`,
          recentPositiveReviews: sql<number>`count(*) filter (
            where ${and(gte(trainerReviews.rating, 4), gte(trainerReviews.createdAt, recentSince))}
          )`,
          average: avg(trainerReviews.rating),
        })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "published"))
        .groupBy(trainerReviews.trainerSlug),
      loadTrainerInterest(),
    ]);
    const ratings = new Map(ratingRows.map((row) => [row.slug, {
      reviews: Number(row.reviews),
      positiveReviews: Number(row.positiveReviews),
      recentPositiveReviews: Number(row.recentPositiveReviews),
      average: Number(row.average),
    }]));

    const ownerIds = profileRows.flatMap((row) => (row.ownerId ? [row.ownerId] : []));
    const roleRows = ownerIds.length
      ? await db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles).where(inArray(userRoles.userId, ownerIds))
      : [];
    const rolesByUser = new Map<string, UserRole[]>();
    for (const row of roleRows) {
      const list = rolesByUser.get(row.userId) ?? [];
      list.push(row.role);
      rolesByUser.set(row.userId, list);
    }

    const hidden = await hiddenStaffIds(context.user.roles);
    const fromDb: AdminTrainer[] = profileRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      verified: row.verified,
      trusted: trainerAccountReady({
        verified: row.verified,
        emailVerifiedAt: row.accountEmailVerifiedAt,
        phoneVerifiedAt: row.accountPhoneVerifiedAt,
      }),
      publishAsked: row.publishRequestedAt != null && row.status !== "published" && row.status !== "declined",
      unclearHold: row.unclearHold,
      ...trainerNameParts(row.firstName, row.lastName, row.fullName),
      headline: row.headline,
      bio: row.bio,
      about: row.about.join("\n\n"),
      ...sportSelection(row.sports),
      city: row.city,
      district: row.district,
      places: placesFromProfile(row),
      priceFrom: row.priceFrom != null && row.priceFrom >= 1 ? row.priceFrom : null,
      languages: row.languages.join(", "),
      phone: formatBelarusPhone(row.phone) || row.phone,
      instagram: row.instagramUrl,
      instagramHandle: row.instagramHandle,
      telegram: row.telegram,
      threads: row.threads,
      email: row.ownerId
        ? hidden.has(row.ownerId) ? "" : (row.email ?? "")
        : row.contactEmail,
      experienceYears: row.experienceYears,
      formats: row.formats,
      audiences: effectiveAudiences(row.audiences),
      avatarPath: row.avatarPath,
      createdAt: row.createdAt.toISOString(),
      publishedAt: publishedAtBySlug.get(row.slug) ?? "",
      ...trainerStats(row.slug, ratings, interest, popularityChecklist({
        photo: row.avatarPath,
        photos: row.photos,
        bio: row.bio,
        about: row.about,
        sports: row.sports,
        experience: row.experienceYears,
        price: row.priceFrom,
        formats: row.formats,
        city: row.city,
        places: row.trainingPlaces,
        address: row.address,
        certificates: row.certificates,
        phone: row.phone,
        instagram: cabinetInstagram({
          instagramUrl: row.instagramUrl,
          instagramHandle: row.instagramHandle,
          createdSource: row.createdSource,
        }),
        telegram: row.telegram,
        email: row.ownerId && !hidden.has(row.ownerId) ? (row.email ?? "") : row.ownerId ? "" : row.contactEmail,
      }), trainerAccountReady({
        verified: row.verified,
        emailVerifiedAt: row.accountEmailVerifiedAt,
        phoneVerifiedAt: row.accountPhoneVerifiedAt,
      })),
      catalog: isCatalog(row.slug),
      offerAccepted: row.offerAcceptedAt != null,
      outreachSentAt: row.outreachSentAt?.toISOString() ?? "",
      inviteSentAt: row.inviteSentAt?.toISOString() ?? "",
      doorEnteredAt: row.doorEnteredAt?.toISOString() ?? "",
      doorSeenAt: row.doorSeenAt?.toISOString() ?? "",
      lastLoginAt: row.ownerId && !hidden.has(row.ownerId) && row.lastLoginAt ? row.lastLoginAt.toISOString() : "",
      account: row.ownerId && !hidden.has(row.ownerId)
        ? {
            id: row.ownerId,
            firstName: row.ownerFirstName ?? "",
            lastName: row.ownerLastName ?? "",
            name: [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" "),
            email: row.email ?? "",
            emailVerified: row.accountEmailVerifiedAt != null,
            emailVerifiedAt: row.accountEmailVerifiedAt?.toISOString() ?? null,
            phone: row.accountPhone ?? "",
            phoneVerified: row.accountPhoneVerifiedAt != null,
            phoneVerifiedAt: row.accountPhoneVerifiedAt?.toISOString() ?? null,
            status: row.accountStatus ?? "",
            roles: rolesByUser.get(row.ownerId) ?? [],
          }
        : null,
    }));

    const known = new Set(fromDb.map((row) => row.slug));
    const fromCatalog: AdminTrainer[] = PUBLISHED_TRAINERS.filter((trainer) => !known.has(trainer.slug)).map((trainer) => ({
      id: null,
      slug: trainer.slug,
      status: "published",
      verified: false,
      trusted: false,
      publishAsked: false,
      unclearHold: false,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      fullName: trainer.name,
      headline: "",
      bio: trainer.bio,
      about: "",
      ...sportSelection(trainer.sports),
      city: trainer.city.label,
      district: trainer.district,
      places: [],
      priceFrom: trainer.priceFrom,
      languages: "",
      phone: trainer.phone,
      instagram: trainer.instagram,
      instagramHandle: trainer.instagram.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i)?.[1]?.toLowerCase() ?? "",
      telegram: "",
      threads: "",
      email: "",
      experienceYears: trainer.experience ?? 0,
      formats: trainer.formats,
      audiences: trainer.audiences,
      avatarPath: trainer.photo,
      createdAt: "",
      publishedAt: publishedAtBySlug.get(trainer.slug) ?? "",
      ...trainerStats(trainer.slug, ratings, interest, popularityChecklist({
        photo: trainer.photo,
        bio: trainer.bio,
        sports: trainer.sports,
        experience: trainer.experience,
        price: trainer.priceFrom,
        formats: trainer.formats,
        city: trainer.city.label,
        phone: trainer.phone,
        instagram: trainer.instagram,
        telegram: trainer.telegram,
        email: trainer.email,
      })),
      catalog: true,
      account: null,
      offerAccepted: false,
      outreachSentAt: "",
      inviteSentAt: "",
      doorEnteredAt: "",
      doorSeenAt: "",
      lastLoginAt: "",
    }));

    const savedOutreach = await loadSiteText("instagram_message");
    return {
      trainers: [...fromDb, ...fromCatalog].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
      outreachText: outreachTemplate(savedOutreach),
    };
  });

export const saveAdminTrainerFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(saveSchema)
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [byId] = data.id
      ? await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, data.id)).limit(1)
      : [];
    const [bySlug] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.slug, data.slug)).limit(1);
    const existing = byId ?? bySlug;
    if (data.id && !byId) {
      throw new AuthError("Профиль тренера не найден.", "VALIDATION");
    }
    if (!existing && !getPublishedTrainer(data.slug)) {
      throw new AuthError("Такой карточки нет в каталоге.", "VALIDATION");
    }

    const firstName = data.firstName.trim().slice(0, 100);
    const lastName = data.lastName.trim().slice(0, 100);
    if (!firstName) throw new AuthError("Укажите имя.", "VALIDATION");
    const published = getPublishedTrainer(data.slug);
    const picked = trainerSportsFromSlugs(data.sportSlugs);
    if (picked.slugs.length > MAX_TRAINER_SPORTS) {
      throw new AuthError("Можно выбрать не больше пяти видов спорта.", "VALIDATION");
    }
    if (picked.sports.length !== picked.slugs.length) {
      throw new AuthError("Выберите вид спорта из списка категорий.", "VALIDATION");
    }
    const sports: TrainerSportRecord[] = picked.sports;
    const city = await assertBelarusCity(data.city);
    const places = await resolveTrainingPlaces(data.places, existing ? placesFromProfile(existing) : []);
    const mirror = mirrorTrainingPlace(places);
    let phone = trainerCardPhone(data.phone);
    let email = data.email.trim();
    let ownerEmailVerifiedAt: Date | null | undefined;
    let ownerPhoneVerifiedAt: Date | null | undefined;
    let ownerNotice: { email: string; emailVerifiedAt: Date | null } | null = null;
    if (existing?.ownerUserId) {
      const [owner] = await db
        .select({ phone: users.phone, email: users.email, emailVerifiedAt: users.emailVerifiedAt, phoneVerifiedAt: users.phoneVerifiedAt })
        .from(users)
        .where(eq(users.id, existing.ownerUserId))
        .limit(1);
      if (owner?.phone) phone = formatBelarusPhone(owner.phone);
      email = owner?.email ?? "";
      ownerEmailVerifiedAt = owner?.emailVerifiedAt ?? null;
      ownerPhoneVerifiedAt = owner?.phoneVerifiedAt ?? null;
      if (owner) ownerNotice = { email: owner.email, emailVerifiedAt: owner.emailVerifiedAt };
    }
    const threads = canonicalThreadsUrl(data.threads);
    if (threads == null) {
      throw new AuthError("Укажите профиль Threads: https://www.threads.com/@имя", "VALIDATION");
    }
    const values = {
      firstName,
      lastName,
      fullName: joinTrainerName(firstName, lastName),
      headline: data.headline,
      bio: sanitizeReviewHtml(data.bio),
      about: storedAbout(data.about),
      sports,
      primarySport: sports[0] ?? null,
      city,
      citySlug: city ? slugify(city) : "",
      district: data.district,
      trainingPlaces: places,
      address: mirror.address,
      addressLat: mirror.addressLat,
      addressLng: mirror.addressLng,
      geocodeStatus: mirror.geocodeStatus,
      priceFrom: data.priceFrom,
      phone,
      email,
      ...(ownerEmailVerifiedAt !== undefined
        ? { emailVerifiedAt: ownerEmailVerifiedAt }
        : existing && normalizeEmail(existing.email) === normalizeEmail(data.email)
          ? {}
          : { emailVerifiedAt: null }),
      instagramUrl: data.instagram,
      telegram: data.telegram,
      threads,
      experienceYears: data.experienceYears,
      formats: [...new Set(data.formats)],
      audiences: effectiveAudiences(data.audiences),
      status: data.status,
      verified: data.verified,
      unclearHold: keptUnclearHold({
        previousStatus: existing?.status ?? "draft",
        previousDoor: existing?.doorEnteredAt ?? null,
        previousHold: existing?.unclearHold ?? false,
        nextStatus: data.status,
        ready: trainerAccountReady({
          verified: data.verified,
          emailVerifiedAt: ownerEmailVerifiedAt ?? null,
          phoneVerifiedAt: ownerPhoneVerifiedAt ?? null,
        }),
      }),
      updatedAt: new Date(),
    };

    try {
      if (existing) {
        const handle = handleFrom(data.instagram, existing.instagramHandle);
        await db.transaction(async (tx) => {
          await stampTrainerRevision(tx, "admin", context.user.id);
          await tx.update(trainerProfiles).set({
            ...values,
            instagramHandle: handle || existing.instagramHandle,
          }).where(eq(trainerProfiles.id, existing.id));
        });
        if (existing.ownerUserId) {
          await db.update(users).set({
            firstName,
            lastName,
            updatedAt: new Date(),
          }).where(eq(users.id, existing.ownerUserId));
        }
      } else {
        const claimToken = randomBytes(32).toString("base64url");
        const [created] = await db.transaction(async (tx) => {
          await stampTrainerRevision(tx, "admin", context.user.id);
          return tx.insert(trainerProfiles).values({
            ...values,
            slug: data.slug,
            instagramHandle: handleFrom(data.instagram, data.slug),
            sourceUrl: data.instagram || `https://trenio.by/trainers/${data.slug}`,
            claimStatus: "unclaimed",
            createdSource: "admin_created",
            audiences: effectiveAudiences(data.audiences),
            formats: [...new Set(data.formats)],
            avatarPath: published?.photo ?? "",
            claimToken,
            claimPath: `/trainers/claim/${claimToken}`,
          }).returning({ id: trainerProfiles.id });
        });
        const { grantPlainUserLike } = await import("@/lib/catalog/plain-user-like.server");
        await grantPlainUserLike(created.id);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        void writeLog({
          level: "warn",
          domain: "form",
          action: "form.trainer_admin",
          outcome: "denied",
          message: error.message,
          actorUserId: context.user.id,
          target: data.slug,
          error,
        });
        throw error;
      }
      const code = (error as { code?: string; cause?: { code?: string } }).code
        ?? (error as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        const taken = new AuthError("Такой адрес Instagram или адрес карточки уже занят.", "VALIDATION");
        void writeLog({
          level: "warn",
          domain: "form",
          action: "form.trainer_admin",
          outcome: "denied",
          message: taken.message,
          actorUserId: context.user.id,
          target: data.slug,
          error: taken,
        });
        throw taken;
      }
      void writeLog({
        level: "error",
        domain: "form",
        action: "form.trainer_admin",
        outcome: "failure",
        message: "Карточка тренера не сохранилась.",
        actorUserId: context.user.id,
        target: data.slug,
        error,
      });
      const failure = new AuthError("Не удалось сохранить профиль.", "VALIDATION");
      markLogged(failure);
      throw failure;
    }

    await stampTrainerPublished(data.slug);
    logTrainerPresence({
      created: !existing,
      previous: existing?.status ?? null,
      next: data.status,
      slug: data.slug,
      actorUserId: context.user.id,
      subject: context.user.email,
      source: existing ? null : "admin_created",
      mode: "save",
    });
    const { sendWelcomeOnPublish } = await import("@/lib/messages/welcome");
    const accountReady = trainerAccountReady({
      verified: data.verified,
      emailVerifiedAt: ownerEmailVerifiedAt ?? null,
      phoneVerifiedAt: ownerPhoneVerifiedAt ?? null,
    });
    const wasReady = existing
      ? trainerAccountReady({
        verified: existing.verified,
        emailVerifiedAt: ownerEmailVerifiedAt ?? null,
        phoneVerifiedAt: ownerPhoneVerifiedAt ?? null,
      })
      : false;
    await sendWelcomeOnPublish({
      previous: existing?.status ?? null,
      next: data.status,
      ownerUserId: existing?.ownerUserId ?? null,
      firstName,
      confirmed: accountReady,
      ownerAttached: Boolean(existing?.status === "published" && accountReady && !wasReady),
    });
    void writeLog({
      level: "info",
      domain: "form",
      action: "form.trainer_admin",
      outcome: "success",
      message: "Карточка тренера сохранена.",
      actorUserId: context.user.id,
      target: data.slug,
    });
    if (!existing || existing.verified !== data.verified) {
      void writeLog({
        level: "info",
        domain: "admin",
        action: "admin.trainer_verify",
        outcome: "success",
        message: data.verified ? verificationMessage("staff-card") : verificationClearedMessage(),
        actorUserId: context.user.id,
        subject: context.user.email,
        target: data.slug,
        context: { via: "staff-card", staff: true },
      });
    }
    if (existing && existing.status !== data.status && (data.status === "published" || existing.status === "published")) {
      void writeLog({
        level: "info",
        domain: "admin",
        action: "admin.trainer_publish",
        outcome: "success",
        message: publishMessage("staff-card", data.status === "published", data.verified),
        actorUserId: context.user.id,
        subject: context.user.email,
        target: data.slug,
        context: { via: "staff-card", staff: true },
      });
    }
    const unverifiedPublish = data.status === "published" && existing?.status !== "published" && !accountReady;
    if (existing && ownerNotice && !unverifiedPublish) {
      void sendProfileStatusNotice({
        email: ownerNotice.email,
        emailVerifiedAt: ownerNotice.emailVerifiedAt,
        slug: data.slug,
        previous: existing.status,
        next: data.status,
      });
    }
    return {
      ok: true as const,
      message: savedWithMapNotice("Профиль тренера сохранён.", places),
      places,
    };
  });

const slugSchema = z.string().trim().min(1).max(30).regex(/^[a-z0-9._-]+$/);

/** Staff publish an unconfirmed card, or return that card to unpublished. Verification stays off. */
export const publishUnverifiedTrainerFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: slugSchema, published: z.boolean() }))
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [row] = await db
      .select({
        id: trainerProfiles.id,
        slug: trainerProfiles.slug,
        status: trainerProfiles.status,
        verified: trainerProfiles.verified,
        ownerUserId: trainerProfiles.ownerUserId,
        firstName: trainerProfiles.firstName,
        doorEnteredAt: trainerProfiles.doorEnteredAt,
        unclearHold: trainerProfiles.unclearHold,
        emailVerifiedAt: users.emailVerifiedAt,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId))
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!row) throw new AuthError("Карточка не найдена.", "VALIDATION");
    if (row.status === "declined") {
      throw new AuthError("Отказанную карточку так не публикуют.", "FORBIDDEN");
    }
    const ready = trainerAccountReady({
      verified: row.verified,
      emailVerifiedAt: row.emailVerifiedAt,
      phoneVerifiedAt: row.phoneVerifiedAt,
    });
    if (ready) {
      throw new AuthError("Аккаунт уже подтверждён. Публикуйте его обычным статусом.", "VALIDATION");
    }
    const next = data.published ? "published" : "draft";
    const wasUnclear = row.status === "draft" && row.doorEnteredAt != null;
    const unclearHold = next === "published" && (wasUnclear || row.unclearHold);
    if (row.status !== next || row.unclearHold !== unclearHold) {
      await db.transaction(async (tx) => {
        await stampTrainerRevision(tx, "admin", context.user.id);
        await tx.update(trainerProfiles).set({
          status: next,
          unclearHold,
          updatedAt: new Date(),
        }).where(eq(trainerProfiles.id, row.id));
      });
      if (next === "published") await stampTrainerPublished(row.slug);
      logTrainerPresence({
        created: false,
        previous: row.status,
        next,
        slug: row.slug,
        actorUserId: context.user.id,
        subject: context.user.email,
        mode: "save",
      });
    }
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.trainer_publish",
      outcome: "success",
      message: publishMessage("staff-switch", next === "published", false),
      actorUserId: context.user.id,
      subject: context.user.email,
      target: row.slug,
      context: { via: "staff-switch", staff: true },
    });
    return { ok: true as const };
  });

const CLAIM_LABEL = { unclaimed: "Не забран", claimed: "Привязан к аккаунту", disputed: "Спор" } as const;
const SOURCE_LABEL = { self: "Сам тренер", branch_created: "Филиал", admin_created: "Администратор", import: "Импорт" } as const;
const AUDIENCE_LABEL = { adult: "Взрослые", teen: "Подростки", kid: "Дети" } as const;
const FORMAT_LABEL = { individual: "Индивидуально", group: "В группе" } as const;
const OTP_LABEL = {
  login: "Код для входа",
  verify_phone: "Код подтверждения телефона",
  register: "Код регистрации",
  reset_password: "Код сброса пароля",
} as const;
const REVIEW_STATUS_LABEL = { pending: "На модерации", published: "Опубликован", rejected: "Отклонён" } as const;
const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

export type AdminTrainerLogin = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
  active: boolean;
};

export type AdminTrainerLog = {
  at: string;
  title: string;
  detail: string;
};

export type AdminTrainerFacts = {
  claimStatus: string;
  createdSource: string;
  instagramHandle: string;
  telegram: string;
  threads: string;
  email: string;
  sourceBio: string;
  audiences: string;
  formats: string;
  pinnedPosts: Array<{ url: string; caption: string }>;
  createdAt: string;
  updatedAt: string;
  claimedAt: string;
  offerAcceptedAt: string;
  privacyAcceptedAt: string;
  offerVersion: string;
  linked: boolean;
  accountName: string;
  accountFirstName: string;
  accountLastName: string;
  accountEmail: string;
  accountPhone: string;
  accountRoles: string;
  accountStatus: string;
  lastLoginAt: string;
};

export type AdminTrainerStats = {
  views: TrainerCabinetPulse;
  rating: TrainerRatingSnapshot;
  telegramVerified: boolean;
  createdSource: string;
};

export type AdminTrainerDetail = {
  trainer: AdminTrainer;
  photos: string[];
  certificates: TrainerCertificate[];
  logins: AdminTrainerLogin[];
  logs: AdminTrainerLog[];
  history: TrainerRevisionView[];
  facts: AdminTrainerFacts;
  stats: AdminTrainerStats;
};

export const getAdminTrainerDetailFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data, context }): Promise<AdminTrainerDetail | null> => {
    assertStaff(context.user.roles);
    await ensureTrainerDoorSchema();
    const db = getDb();
    const [row] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.slug, data.slug)).limit(1);
    if (!row) return null;
    const recentSince = recentReviewStart();
    const publishedAtBySlug = await loadPublishedAt();

    const hidden = await hiddenStaffIds(context.user.roles);
    const ownerVisible = Boolean(row.ownerUserId) && !hidden.has(row.ownerUserId ?? "");
    const [ratingRows, reviewRows, owner, roleRows, interest, pulse] = await Promise.all([
      db
        .select({
          reviews: count(),
          positiveReviews: sql<number>`count(*) filter (where ${trainerReviews.rating} >= 4)`,
          recentPositiveReviews: sql<number>`count(*) filter (
            where ${and(gte(trainerReviews.rating, 4), gte(trainerReviews.createdAt, recentSince))}
          )`,
          average: avg(trainerReviews.rating),
        })
        .from(trainerReviews)
        .where(and(eq(trainerReviews.trainerSlug, row.slug), eq(trainerReviews.status, "published"))),
      db
        .select({
          authorName: trainerReviews.authorName,
          rating: trainerReviews.rating,
          status: trainerReviews.status,
          createdAt: trainerReviews.createdAt,
          userId: trainerReviews.userId,
        })
        .from(trainerReviews)
        .where(eq(trainerReviews.trainerSlug, row.slug))
        .orderBy(desc(trainerReviews.createdAt))
        .limit(40),
      ownerVisible && row.ownerUserId
        ? db
            .select({
              id: users.id,
              email: users.email,
              emailVerifiedAt: users.emailVerifiedAt,
              firstName: users.firstName,
              lastName: users.lastName,
              phone: users.phone,
              phoneVerifiedAt: users.phoneVerifiedAt,
              status: users.status,
              lastLoginAt: users.lastLoginAt,
            })
            .from(users)
            .where(eq(users.id, row.ownerUserId))
            .limit(1)
            .then((items) => items[0] ?? null)
        : Promise.resolve(null),
      ownerVisible && row.ownerUserId
        ? db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, row.ownerUserId))
        : Promise.resolve([]),
      loadTrainerInterest(),
      loadProfilePulse(
        { id: row.id, slug: row.slug, ownerUserId: row.ownerUserId },
        context.user.id,
      ).catch((error: unknown) => {
        logCaught("catalog", "catalog.view", error, { actorUserId: context.user.id, target: row.slug });
        return blankTrainerPulse();
      }),
    ]);

    const ownerId = owner?.id ?? null;
    const [loginRows, resetRows, emailRows, otpRows] = ownerId
      ? await Promise.all([
          db.select({
            id: sessions.id,
            createdAt: sessions.createdAt,
            expiresAt: sessions.expiresAt,
            ipAddress: sessions.ipAddress,
            userAgent: sessions.userAgent,
          }).from(sessions).where(eq(sessions.userId, ownerId)).orderBy(desc(sessions.createdAt)).limit(40),
          db.select({
            createdAt: passwordResetTokens.createdAt,
            usedAt: passwordResetTokens.usedAt,
          }).from(passwordResetTokens).where(eq(passwordResetTokens.userId, ownerId)).orderBy(desc(passwordResetTokens.createdAt)).limit(20),
          db.select({
            createdAt: emailVerificationTokens.createdAt,
            usedAt: emailVerificationTokens.usedAt,
            pendingEmail: emailVerificationTokens.pendingEmail,
          }).from(emailVerificationTokens).where(eq(emailVerificationTokens.userId, ownerId)).orderBy(desc(emailVerificationTokens.createdAt)).limit(20),
          db.select({
            purpose: authOtpChallenges.purpose,
            createdAt: authOtpChallenges.createdAt,
            consumedAt: authOtpChallenges.consumedAt,
            attemptCount: authOtpChallenges.attemptCount,
          }).from(authOtpChallenges).where(eq(authOtpChallenges.userId, ownerId)).orderBy(desc(authOtpChallenges.createdAt)).limit(20),
        ])
      : [[], [], [], []];

    const reviews = Number(ratingRows[0]?.reviews ?? 0);
    const positiveReviews = Number(ratingRows[0]?.positiveReviews ?? 0);
    const recentPositiveReviews = Number(ratingRows[0]?.recentPositiveReviews ?? 0);
    const average = Number(ratingRows[0]?.average ?? 0);
    const version = row.updatedAt.getTime();
    const roles = roleRows.map((item) => item.role);
    const now = Date.now();
    const logs: AdminTrainerLog[] = [
      { at: row.createdAt.toISOString(), title: "Карточка создана", detail: SOURCE_LABEL[row.createdSource] },
    ];
    if (row.updatedAt.getTime() - row.createdAt.getTime() > 1000) {
      logs.push({ at: row.updatedAt.toISOString(), title: "Карточка изменена", detail: "" });
    }
    if (row.claimedAt) logs.push({ at: row.claimedAt.toISOString(), title: "Профиль забран", detail: CLAIM_LABEL[row.claimStatus] });
    if (row.doorEnteredAt) logs.push({ at: row.doorEnteredAt.toISOString(), title: "Открыл короткую ссылку", detail: "" });
    if (row.doorSeenAt && (!row.doorEnteredAt || row.doorSeenAt.getTime() - row.doorEnteredAt.getTime() > 1000)) {
      logs.push({ at: row.doorSeenAt.toISOString(), title: "Снова открыл короткую ссылку", detail: "" });
    }
    for (const review of reviewRows) {
      if (hidden.has(review.userId)) continue;
      logs.push({
        at: review.createdAt.toISOString(),
        title: `Отзыв · ${REVIEW_STATUS_LABEL[review.status]}`,
        detail: `${review.authorName}, ${review.rating} из 5`,
      });
    }
    for (const token of resetRows) {
      logs.push({
        at: token.createdAt.toISOString(),
        title: "Сброс пароля",
        detail: token.usedAt ? "Ссылка использована" : "Ссылка отправлена",
      });
    }
    for (const token of emailRows) {
      logs.push({
        at: token.createdAt.toISOString(),
        title: "Подтверждение почты",
        detail: token.pendingEmail ? token.pendingEmail : token.usedAt ? "Письмо подтверждено" : "Письмо отправлено",
      });
    }
    for (const otp of otpRows) {
      logs.push({
        at: otp.createdAt.toISOString(),
        title: OTP_LABEL[otp.purpose],
        detail: otp.consumedAt ? "Код использован" : `Код не использован, попыток: ${otp.attemptCount}`,
      });
    }
    logs.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const journal = await listActorJournal({
      actorUserId: ownerId,
      subject: owner?.email,
      target: row.slug,
    });
    const mergedLogs = mergeJournal(logs, journal);
    const fill = popularityChecklist({
      photo: row.avatarPath,
      photos: row.photos,
      bio: row.bio,
      about: row.about,
      sports: row.sports,
      experience: row.experienceYears,
      price: row.priceFrom,
      formats: row.formats,
      city: row.city,
      places: row.trainingPlaces,
      address: row.address,
      certificates: row.certificates,
      phone: row.phone,
      instagram: cabinetInstagram({
        instagramUrl: row.instagramUrl,
        instagramHandle: row.instagramHandle,
        createdSource: row.createdSource,
      }),
      telegram: row.telegram,
      email: owner ? owner.email : row.email,
    });

    return {
      trainer: {
        id: row.id,
        slug: row.slug,
        status: row.status,
        verified: row.verified,
        trusted: trainerAccountReady({
          verified: row.verified,
          emailVerifiedAt: owner?.emailVerifiedAt ?? null,
          phoneVerifiedAt: owner?.phoneVerifiedAt ?? null,
        }),
        publishAsked: row.publishRequestedAt != null && row.status !== "published" && row.status !== "declined",
        unclearHold: row.unclearHold,
        publishedAt: publishedAtBySlug.get(row.slug) ?? "",
        ...trainerNameParts(row.firstName, row.lastName, row.fullName),
        headline: row.headline,
        bio: row.bio,
        about: editorHtml(row.about),
        ...sportSelection(row.sports),
        city: row.city,
        district: row.district,
        places: placesFromProfile(row),
        priceFrom: row.priceFrom != null && row.priceFrom >= 1 ? row.priceFrom : null,
        languages: row.languages.join(", "),
        phone: formatBelarusPhone(row.phone) || row.phone,
        instagram: row.instagramUrl,
        instagramHandle: row.instagramHandle,
        telegram: row.telegram,
        threads: row.threads,
        email: owner ? owner.email : row.email,
        experienceYears: row.experienceYears,
        formats: row.formats,
        audiences: effectiveAudiences(row.audiences),
        avatarPath: row.avatarPath ? `${row.avatarPath}?v=${version}` : "",
        createdAt: row.createdAt.toISOString(),
        reviews,
        rating: reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : "0",
        popularity: popularityScore({
          rating: reviews > 0 ? average.toFixed(1) : "0",
          reviews,
          positiveReviews,
          recentPositiveReviews,
          ...(interest[row.slug] ?? emptyTrainerInterest),
          cardFilled: fill.card,
          contactsFilled: fill.contacts,
          verified: trainerAccountReady({
            verified: row.verified,
            emailVerifiedAt: owner?.emailVerifiedAt ?? null,
            phoneVerifiedAt: owner?.phoneVerifiedAt ?? null,
          }),
        }),
        catalog: isCatalog(row.slug),
        offerAccepted: row.offerAcceptedAt != null,
        outreachSentAt: row.outreachSentAt?.toISOString() ?? "",
        inviteSentAt: row.inviteSentAt?.toISOString() ?? "",
        doorEnteredAt: row.doorEnteredAt?.toISOString() ?? "",
        doorSeenAt: row.doorSeenAt?.toISOString() ?? "",
        lastLoginAt: owner?.lastLoginAt ? owner.lastLoginAt.toISOString() : "",
        account: owner
          ? {
              id: owner.id,
              firstName: owner.firstName,
              lastName: owner.lastName ?? "",
              name: [owner.firstName, owner.lastName].filter(Boolean).join(" "),
              email: owner.email,
              emailVerified: owner.emailVerifiedAt != null,
              emailVerifiedAt: owner.emailVerifiedAt?.toISOString() ?? null,
              phone: owner.phone ?? "",
              phoneVerified: owner.phoneVerifiedAt != null,
              phoneVerifiedAt: owner.phoneVerifiedAt?.toISOString() ?? null,
              status: owner.status,
              roles,
            }
          : null,
      },
      photos: (row.photos.length > 0 ? row.photos : row.avatarPath ? [row.avatarPath] : []).map((item) => `${item}?v=${version}`),
      certificates: versionedCertificates(readCertificates(row.certificates)),
      logins: loginRows.map((login) => ({
        id: login.id,
        createdAt: login.createdAt.toISOString(),
        expiresAt: login.expiresAt.toISOString(),
        ip: login.ipAddress || "—",
        userAgent: login.userAgent || "—",
        active: login.expiresAt.getTime() > now,
      })),
      logs: mergedLogs,
      history: await listTrainerRevisionViews(row.id),
      facts: {
        claimStatus: CLAIM_LABEL[row.claimStatus],
        createdSource: SOURCE_LABEL[row.createdSource],
        instagramHandle: row.instagramHandle,
        telegram: row.telegram,
        threads: row.threads,
        email: owner ? owner.email : row.email,
        sourceBio: row.sourceBio,
        audiences: effectiveAudiences(row.audiences).map((item) => AUDIENCE_LABEL[item]).join(", "),
        formats: row.formats.map((item) => FORMAT_LABEL[item]).join(", "),
        pinnedPosts: row.pinnedPosts.map((post) => ({ url: post.url, caption: post.caption })),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        claimedAt: row.claimedAt ? row.claimedAt.toISOString() : "",
        offerAcceptedAt: row.offerAcceptedAt ? row.offerAcceptedAt.toISOString() : "",
        privacyAcceptedAt: row.privacyAcceptedAt ? row.privacyAcceptedAt.toISOString() : "",
        offerVersion: row.offerVersion,
        linked: Boolean(owner),
        accountName: owner ? [owner.firstName, owner.lastName].filter(Boolean).join(" ") : "",
        accountFirstName: owner?.firstName ?? "",
        accountLastName: owner?.lastName ?? "",
        accountEmail: owner?.email ?? "",
        accountPhone: owner?.phone ?? "",
        accountRoles: roles.join(", "),
        accountStatus: owner ? ACCOUNT_STATUS_LABEL[owner.status] ?? owner.status : "",
        lastLoginAt: owner?.lastLoginAt ? owner.lastLoginAt.toISOString() : "",
      },
      stats: {
        views: pulse,
        rating: {
          rating: reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : "0",
          reviews,
          positiveReviews,
          recentPositiveReviews,
          ...(interest[row.slug] ?? emptyTrainerInterest),
        },
        telegramVerified: row.telegramVerifiedAt != null,
        createdSource: row.createdSource,
      },
    };
  });

const imageSchema = z.object({
  slug: slugSchema,
  image: z.string().max(2_200_000),
});
const pathSchema = z.object({
  slug: slugSchema,
  path: z.string().trim().min(1).max(300),
});

export const addAdminTrainerPhotoFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(imageSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const saved = await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      const [fresh] = await tx.select().from(trainerProfiles).where(eq(trainerProfiles.id, row.id)).for("update").limit(1);
      if (!fresh) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
      const base = fresh.photos.length > 0 ? fresh.photos : fresh.avatarPath ? [fresh.avatarPath.split("?")[0]] : [];
      if (base.length >= MAX_TRAINER_PHOTOS) {
        throw new AuthError("Можно загрузить не больше девяти фото.", "VALIDATION");
      }
      const stored = await writeTrainerImage(data.slug, "photos", data.image);
      const photos = [...base, stored];
      await tx.update(trainerProfiles).set({
        photos,
        avatarPath: photos[0] ?? "",
        updatedAt: new Date(),
      }).where(eq(trainerProfiles.id, fresh.id));
      return { stored, photos };
    });
    await syncOwnerAvatar(row.ownerUserId, saved.photos[0] ?? "");
    return { ok: true as const, photo: versioned([saved.stored])[0], photos: versioned(saved.photos) };
  });

export const removeAdminTrainerPhotoFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(pathSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const target = data.path.split("?")[0];
    const photos = row.photos.filter((item) => item !== target);
    if (photos.length === row.photos.length && row.avatarPath !== target) {
      throw new AuthError("Это фото уже удалено.", "VALIDATION");
    }
    await removeTrainerFile(data.slug, target);
    const next = photos.length > 0 ? photos : row.avatarPath === target ? [] : row.photos;
    await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      await tx.update(trainerProfiles).set({
        photos: next,
        avatarPath: next[0] ?? "",
        updatedAt: new Date(),
      }).where(eq(trainerProfiles.id, row.id));
    });
    await syncOwnerAvatar(row.ownerUserId, next[0] ?? "");
    return { ok: true as const, photos: versioned(next) };
  });

const orderSchema = z.object({
  slug: slugSchema,
  paths: z.array(z.string().trim().min(1).max(300)).max(MAX_TRAINER_PHOTOS),
});

export const reorderAdminTrainerPhotosFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(orderSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const current = (row.photos.length > 0 ? row.photos : row.avatarPath ? [row.avatarPath] : []).map((item) => item.split("?")[0]).sort();
    const next = data.paths.map((item) => item.split("?")[0]);
    const same = next.length === current.length && [...next].sort().every((item, index) => item === current[index]);
    if (!same) throw new AuthError("Порядок фото не совпадает с сохранёнными файлами.", "VALIDATION");
    await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      await tx.update(trainerProfiles).set({
        photos: next,
        avatarPath: next[0] ?? "",
        updatedAt: new Date(),
      }).where(eq(trainerProfiles.id, row.id));
    });
    await syncOwnerAvatar(row.ownerUserId, next[0] ?? "");
    return { ok: true as const, photos: versioned(next) };
  });

const certificateSchema = z.object({
  slug: slugSchema,
  fileName: z.string().trim().min(1).max(180),
  caption: z.string().trim().min(1).max(CERTIFICATE_CAPTION_MAX),
  dataUrl: z.string().max(11_000_000),
});

const captionSchema = z.object({
  slug: slugSchema,
  path: z.string().trim().min(1).max(300),
  caption: z.string().trim().min(1).max(CERTIFICATE_CAPTION_MAX),
});

export const addAdminTrainerCertificateFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(certificateSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const current = readCertificates(row.certificates);
    if (current.length >= MAX_TRAINER_CERTIFICATES) {
      throw new AuthError("Можно загрузить не больше пяти документов.", "VALIDATION");
    }
    const stored = await writeTrainerFile(data.slug, "certificates", data.fileName, data.dataUrl);
    const certificates = [...current, { path: stored, caption: data.caption.trim() }];
    await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      await tx.update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
    });
    const shown = versionedCertificates(certificates);
    return { ok: true as const, certificate: shown[shown.length - 1], certificates: shown };
  });

export const updateAdminTrainerCertificateFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(captionSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const target = data.path.split("?")[0];
    const current = readCertificates(row.certificates);
    if (!current.some((item) => item.path === target)) {
      throw new AuthError("Этот документ уже удалён.", "VALIDATION");
    }
    const certificates = current.map((item) => item.path === target ? { ...item, caption: data.caption.trim() } : item);
    await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      await tx.update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
    });
    return { ok: true as const, certificates: versionedCertificates(certificates) };
  });

export const removeAdminTrainerCertificateFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(pathSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const target = data.path.split("?")[0];
    const current = readCertificates(row.certificates);
    const certificates = current.filter((item) => item.path !== target);
    if (certificates.length === current.length) {
      throw new AuthError("Этот документ уже удалён.", "VALIDATION");
    }
    await removeTrainerFile(data.slug, target);
    await getDb().transaction(async (tx) => {
      await stampTrainerRevision(tx, "admin", context.user.id);
      await tx.update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
    });
    return { ok: true as const, certificates: versionedCertificates(certificates) };
  });

const trainerPhoneSchema = z.object({
  slug: slugSchema,
  phone: z.string().trim().min(1).max(32),
});

async function linkedOwnerId(slug: string, roles: UserRole[]) {
  assertStaff(roles);
  const row = await editableTrainer(slug, { id: "", roles });
  if (!row.ownerUserId) {
    throw new AuthError("Подтверждение по SMS доступно, когда к карточке привязан аккаунт.", "VALIDATION");
  }
  return row.ownerUserId;
}

export const requestAdminTrainerPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(trainerPhoneSchema)
  .handler(async ({ data, context }) => {
    const ownerId = await linkedOwnerId(data.slug, context.user.roles);
    return requestAccountPhoneCode(ownerId, data.phone, null, { skipStepUp: true });
  });

export const confirmAdminTrainerPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(trainerPhoneSchema.extend({ code: z.string().trim().min(4).max(8) }))
  .handler(async ({ data, context }) => {
    const ownerId = await linkedOwnerId(data.slug, context.user.roles);
    return confirmAccountPhoneCode(ownerId, data.phone, data.code, null, {
      via: "staff-sms",
      actorUserId: context.user.id,
      subject: context.user.email,
    });
  });
