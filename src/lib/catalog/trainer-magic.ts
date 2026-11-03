import { randomBytes } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

import { optionalAuthMiddleware, requireAuthMiddleware, requireSessionMiddleware } from "@/auth/middleware";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { hashPassword, normalizeEmail, validatePasswordStrength } from "@/auth/password";
import { setSessionCookie, setTotpTicketCookie } from "@/auth/session";
import { beginLogin, findUserByEmail } from "@/auth/service";
import { addMinutes, generateSecureToken, hashToken } from "@/auth/tokens";
import { getDb } from "@/db";
import { authDoorClaims, trainerProfiles, userRoles, users, type TrainerProfile } from "@/db/schema";
import { renderLetter } from "@/lib/mail/letter";
import { mailTransportReady, sendMail } from "@/lib/mail/send.server";
import { assertStaff } from "@/lib/admin/access";
import { AuthError } from "@/lib/auth/errors";
import { formatBelarusPhone, validateBelarusMobile } from "@/lib/auth/phone";
import { isStaff } from "@/lib/auth/roles";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { readCertificates } from "@/lib/catalog/certificate-file";
import { sanitizeReviewHtml, reviewPlainText } from "@/lib/catalog/review-html";
import { trainerInviteMessage, inviteMissingLines } from "@/lib/catalog/trainer-invite";
import { loadSiteText } from "@/lib/site-texts/store";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import {
  effectiveAudiences,
  type PublishedTrainer,
  type TrainerAudience,
  type TrainerFormat,
} from "@/lib/catalog/published-trainers";
import { MAX_TRAINER_SPORTS, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { placesFromProfile, placesShape, savedWithMapNotice } from "@/lib/geo/schemas";
import { logCaught, writeLog } from "@/lib/log/logger";

const PREVIEW_COOKIE = "trenio_trainer_preview";
const EDIT_COOKIE = "trenio_trainer_edit";
const LINK_MAX_AGE = 60 * 30;

function requestOrigin() {
  const fallback = (process.env.APP_URL ?? "http://trenio.local").replace(/\/$/, "");
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return fallback;
  }
}

const DOOR_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

function shortCode() {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i += 1) code += DOOR_ALPHABET[bytes[i] % DOOR_ALPHABET.length];
  return code;
}

const doorCodeSchema = z.string().trim().toLowerCase().regex(/^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: LINK_MAX_AGE,
  };
}

/** An imported card with no street and no settlement is shown in Minsk. */
function importedCityLabel(row: TrainerProfile): string {
  const stored = row.city.trim();
  if (stored) return stored;
  if (row.createdSource !== "import") return "";
  if ((row.address ?? "").trim()) return "";
  const placed = (row.trainingPlaces ?? []).some((place) =>
    (place.city ?? "").trim() || (place.address ?? "").trim() || (place.district ?? "").trim(),
  );
  return placed ? "" : "Минск";
}

export function profileToPublished(row: TrainerProfile): PublishedTrainer {
  const sports = (row.sports ?? []).flatMap((sport) => {
    const slug = sport?.slug?.trim() ?? "";
    if (!slug) return [];
    return [{
      slug,
      parentSlug: sport.parentSlug?.trim() || slug,
      label: sport.label?.trim() || slug,
    }];
  }).slice(0, MAX_TRAINER_SPORTS);
  const primary = row.primarySport?.slug
    ? {
        slug: row.primarySport.slug,
        parentSlug: row.primarySport.parentSlug || row.primarySport.slug,
        label: row.primarySport.label || row.primarySport.slug,
      }
    : sports[0] ?? { slug: "", parentSlug: "", label: "" };
  const cityLabel = importedCityLabel(row);
  return {
    slug: row.slug,
    name: joinTrainerName(row.firstName, row.lastName) || row.fullName || row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    photo: row.avatarPath,
    city: { slug: cityLabel ? cityCatalogSlug(cityLabel) ?? "" : "", label: cityLabel },
    sports: sports.length ? sports : primary.slug ? [primary] : [],
    primarySport: primary,
    bio: row.bio,
    audiences: effectiveAudiences(row.audiences),
    formats: row.formats,
    phone: row.phone,
    instagram: row.instagramUrl,
    telegram: row.telegram,
    email: row.email,
    experience: row.experienceYears,
    priceFrom: row.priceFrom ?? 0,
    district: row.district,
  };
}

export const loadVisibleTrainerFn = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    const [row] = await getDb().select().from(trainerProfiles).where(eq(trainerProfiles.slug, data.slug)).limit(1);
    if (!row) return null;
    const staff = isStaff(context.user?.roles ?? []);
    const preview = getCookie(PREVIEW_COOKIE) === data.slug;
    const owner = Boolean(context.user && row.ownerUserId === context.user.id);
    if (row.status === "published") return { trainer: profileToPublished(row), access: "public" as const };
    if (owner) return { trainer: profileToPublished(row), access: "owner" as const };
    if (preview) return { trainer: profileToPublished(row), access: "preview" as const };
    if (staff) return { trainer: profileToPublished(row), access: "staff" as const };
    return null;
  });

export const issueTrainerInviteFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [row] = await db.select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      fullName: trainerProfiles.fullName,
      status: trainerProfiles.status,
      city: trainerProfiles.city,
      trainingPlaces: trainerProfiles.trainingPlaces,
      address: trainerProfiles.address,
      priceFrom: trainerProfiles.priceFrom,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
      sports: trainerProfiles.sports,
      phone: trainerProfiles.phone,
      about: trainerProfiles.about,
      bio: trainerProfiles.bio,
      experienceYears: trainerProfiles.experienceYears,
      formats: trainerProfiles.formats,
      audiences: trainerProfiles.audiences,
    }).from(trainerProfiles).where(eq(trainerProfiles.slug, data.slug)).limit(1);
    if (!row) {
      void writeLog({
        level: "warn",
        domain: "admin",
        action: "admin.trainer_invite",
        outcome: "denied",
        message: "Профиль тренера не найден.",
        actorUserId: context.user.id,
        target: data.slug,
      });
      throw new AuthError("Профиль тренера не найден.", "VALIDATION");
    }
    if (row.status === "published") {
      void writeLog({
        level: "warn",
        domain: "admin",
        action: "admin.trainer_invite",
        outcome: "denied",
        message: "Профиль уже опубликован. Сообщение не отправляется.",
        actorUserId: context.user.id,
        target: data.slug,
      });
      throw new AuthError("Профиль уже опубликован. Сообщение больше не отправляется.", "VALIDATION");
    }
    let code = shortCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [clash] = await db.select({ id: trainerProfiles.id }).from(trainerProfiles).where(eq(trainerProfiles.previewToken, code)).limit(1);
      if (!clash) break;
      code = shortCode();
    }
    await db.update(trainerProfiles).set({
      previewToken: code,
      editToken: null,
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, row.id));
    const origin = requestOrigin();
    const text = trainerInviteMessage({
      name: row.firstName.trim() || row.fullName.trim(),
      doorUrl: `${origin}/hi/${code}`,
      publicUrl: `${origin}/trainers/${row.slug}`,
      published: false,
      template: await loadSiteText("instagram_message"),
      missing: inviteMissingLines({
        city: row.city,
        places: row.trainingPlaces ?? [],
        address: row.address,
        priceFrom: row.priceFrom,
        photo: row.avatarPath || (row.photos ?? [])[0] || "",
        sports: (row.sports ?? []).filter((sport) => sport?.slug?.trim()).length,
        phone: row.phone,
        about: (row.about ?? []).join(" "),
        bio: row.bio,
        experienceYears: row.experienceYears,
        formats: (row.formats ?? []).length,
        audiences: (row.audiences ?? []).length,
        lastName: row.lastName,
      }),
    });
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.trainer_invite",
      outcome: "success",
      message: "Скопирован текст со ссылками на профиль.",
      actorUserId: context.user.id,
      target: row.slug,
    });
    return { text };
  });

export const markTrainerInviteSentFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [row] = await db
      .select({ id: trainerProfiles.id, status: trainerProfiles.status })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!row) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
    if (row.status === "published") {
      throw new AuthError("Профиль уже опубликован. Сообщение больше не отправляется.", "VALIDATION");
    }
    const sentAt = new Date();
    await db.update(trainerProfiles).set({ inviteSentAt: sentAt }).where(eq(trainerProfiles.id, row.id));
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.trainer_invite_sent",
      outcome: "success",
      message: "Сообщение отмечено отправленным.",
      actorUserId: context.user.id,
      target: data.slug,
    });
    return { inviteSentAt: sentAt.toISOString() };
  });

export const openTrainerPreviewFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().trim().min(20).max(80) }))
  .handler(async ({ data }) => {
    const [row] = await getDb().select({
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
    }).from(trainerProfiles).where(eq(trainerProfiles.previewToken, data.token)).limit(1);
    if (!row) {
      void writeLog({
        level: "warn",
        domain: "catalog",
        action: "catalog.trainer_preview",
        outcome: "denied",
        message: "Ссылка на профиль не найдена.",
      });
      return null;
    }
    const published = row.status === "published";
    if (!published) setCookie(PREVIEW_COOKIE, row.slug, cookieOptions());
    void writeLog({
      level: "info",
      domain: "catalog",
      action: "catalog.trainer_preview",
      outcome: "success",
      message: published ? "Ссылка на профиль ведёт в каталог." : "Ссылка на профиль открыта.",
      target: row.slug,
    });
    return { slug: row.slug, published };
  });

export const openTrainerEditFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().trim().min(20).max(80) }))
  .handler(async ({ data }) => {
    const [row] = await getDb().select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
    }).from(trainerProfiles).where(eq(trainerProfiles.editToken, data.token)).limit(1);
    if (!row) {
      void writeLog({
        level: "warn",
        domain: "catalog",
        action: "catalog.trainer_edit",
        outcome: "denied",
        message: "Ссылка на редактирование не найдена.",
      });
      return null;
    }
    const published = row.status === "published";
    if (!published) setCookie(EDIT_COOKIE, row.id, cookieOptions());
    void writeLog({
      level: "info",
      domain: "catalog",
      action: "catalog.trainer_edit",
      outcome: "success",
      message: published ? "Ссылка на редактирование ведёт в каталог." : "Ссылка на редактирование открыта.",
      target: row.slug,
    });
    return { slug: row.slug, published };
  });

async function noteMissingDoor() {
  try {
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    const limit = await consumeRateLimit(`invite-miss:${ip}`, 15 * 60_000, 20);
    if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  } catch (error) {
    if (error instanceof AuthError) throw error;
  }
}

async function doorByCode(code: string) {
  const [row] = await getDb().select({
    id: trainerProfiles.id,
    slug: trainerProfiles.slug,
    status: trainerProfiles.status,
    firstName: trainerProfiles.firstName,
    lastName: trainerProfiles.lastName,
    fullName: trainerProfiles.fullName,
    avatarPath: trainerProfiles.avatarPath,
    city: trainerProfiles.city,
    headline: trainerProfiles.headline,
    ownerUserId: trainerProfiles.ownerUserId,
  }).from(trainerProfiles).where(eq(trainerProfiles.previewToken, code)).limit(1);
  if (!row) {
    await noteMissingDoor();
    void writeLog({
      level: "warn",
      domain: "catalog",
      action: "catalog.trainer_preview",
      outcome: "denied",
      message: "Короткая ссылка не найдена.",
    });
    return null;
  }
  return row;
}

export const getTrainerDoorFn = createServerFn({ method: "GET" })
  .validator(z.object({ code: doorCodeSchema }))
  .handler(async ({ data }) => {
    const row = await doorByCode(data.code);
    if (!row) return null;
    const name = row.firstName.trim() || row.fullName.trim() || row.slug;
    return {
      name,
      slug: row.slug,
      photo: row.avatarPath,
      line: [row.headline.trim(), row.city.trim()].filter(Boolean).join(" · "),
      published: row.status === "published",
    };
  });

export const openTrainerDoorFn = createServerFn({ method: "POST" })
  .validator(z.object({ code: doorCodeSchema, kind: z.enum(["view", "edit"]) }))
  .handler(async ({ data }) => {
    const row = await doorByCode(data.code);
    if (!row) return null;
    const published = row.status === "published";
    if (!published && data.kind === "view") setCookie(PREVIEW_COOKIE, row.slug, cookieOptions());
    if (!published && data.kind === "edit") setCookie(EDIT_COOKIE, row.id, cookieOptions());
    void writeLog({
      level: "info",
      domain: "catalog",
      action: data.kind === "edit" ? "catalog.trainer_edit" : "catalog.trainer_preview",
      outcome: "success",
      message: published ? "Короткая ссылка ведёт в каталог." : data.kind === "edit" ? "Короткая ссылка открыла правку." : "Короткая ссылка открыла профиль.",
      target: row.slug,
    });
    return { slug: row.slug, published };
  });

async function profileFromEditCookie() {
  const id = getCookie(EDIT_COOKIE) ?? "";
  if (!id) return null;
  const [row] = await getDb().select().from(trainerProfiles).where(eq(trainerProfiles.id, id)).limit(1);
  return row ?? null;
}

const cardSchema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя.").max(100),
  lastName: z.string().trim().max(100),
  headline: z.string().trim().max(200),
  bio: z.string().max(8000),
  about: z.string().max(8000),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  district: z.string().trim().max(120),
  ...placesShape,
  phone: z.string().trim().max(32),
  priceFrom: z.number().int().min(1).max(1_000_000).nullable(),
  experienceYears: z.number().int().min(0).max(80),
  instagram: z.string().trim().max(300),
  telegram: z.string().trim().max(300),
  email: z.string().trim().max(320),
  formats: z.array(z.enum(["individual", "group"])).max(2),
  audiences: z.array(z.enum(["adult", "kid", "teen"])).max(3),
  status: z.enum(["published", "hidden"]).default("published"),
});

function phoneOrEmpty(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const formatted = formatBelarusPhone(trimmed);
  if (!formatted) throw new AuthError(validateBelarusMobile(trimmed) || "Укажите мобильный номер РБ: +375 25/29/33/44 …", "VALIDATION");
  return formatted;
}

export type MagicTrainerDraft = {
  slug: string;
  status: TrainerProfile["status"];
  canPublish: boolean;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  about: string;
  sportSlugs: string[];
  city: string;
  district: string;
  places: ReturnType<typeof placesFromProfile>;
  priceFrom: number | null;
  experienceYears: number;
  instagram: string;
  telegram: string;
  email: string;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
  phone: string;
  phoneLocked: boolean;
  /** Short Instagram link is open and the profile is still unclaimed. */
  magicDoor: boolean;
  /** Mailbox that still has an unused profile link. Empty when none is waiting. */
  mailSentTo: string | null;
  photos: string[];
  certificates: ReturnType<typeof readCertificates>;
};

export const getMagicTrainerFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<MagicTrainerDraft | null> => {
    const row = await profileFromEditCookie();
    if (!row) return null;
    const sports = trainerSportsFromSlugs((row.sports ?? []).map((sport) => sport.slug)).slugs;
    const [pendingMail] = await getDb()
      .select({ email: authDoorClaims.email })
      .from(authDoorClaims)
      .where(and(
        eq(authDoorClaims.profileId, row.id),
        isNull(authDoorClaims.usedAt),
        gt(authDoorClaims.expiresAt, new Date()),
      ))
      .orderBy(desc(authDoorClaims.createdAt))
      .limit(1);
    return {
      slug: row.slug,
      status: row.status,
      canPublish: row.status === "draft",
      firstName: row.firstName,
      lastName: row.lastName,
      headline: row.headline,
      bio: row.bio,
      about: (row.about ?? []).join("\n\n"),
      sportSlugs: sports,
      city: row.city,
      district: row.district,
      places: placesFromProfile(row),
      priceFrom: row.priceFrom != null && row.priceFrom >= 1 ? row.priceFrom : null,
      experienceYears: row.experienceYears,
      instagram: row.instagramUrl,
      telegram: row.telegram,
      email: row.email,
      formats: row.formats,
      audiences: row.audiences,
      phone: row.phone,
      phoneLocked: Boolean(row.ownerUserId),
      magicDoor: getCookie(PREVIEW_COOKIE) === row.slug && Boolean(row.previewToken) && !row.ownerUserId && row.status !== "published",
      mailSentTo: pendingMail?.email ?? null,
      photos: (row.photos?.length ? row.photos : row.avatarPath ? [row.avatarPath] : []).slice(0, 9),
      certificates: readCertificates(row.certificates),
    };
  });

async function saveFromCookie(data: z.infer<typeof cardSchema>, publish: boolean) {
  const row = await profileFromEditCookie();
  if (!row) {
    void writeLog({
      level: "warn",
      domain: "catalog",
      action: publish ? "catalog.trainer_publish" : "catalog.trainer_save",
      outcome: "denied",
      message: "Ссылка на редактирование уже не действует.",
    });
    throw new AuthError("Ссылка на редактирование уже не действует.", "VALIDATION");
  }
  const picked = trainerSportsFromSlugs(data.sportSlugs);
  if (picked.slugs.length > MAX_TRAINER_SPORTS || picked.sports.length !== picked.slugs.length) {
    throw new AuthError("Выберите вид спорта из списка категорий.", "VALIDATION");
  }
  const city = await assertBelarusCity(data.city);
  const places = await resolveTrainingPlaces(data.places, placesFromProfile(row));
  const mirror = mirrorTrainingPlace(places);
  const aboutHtml = sanitizeReviewHtml(data.about);
  const values = {
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: joinTrainerName(data.firstName, data.lastName),
    headline: data.headline,
    bio: sanitizeReviewHtml(data.bio),
    about: reviewPlainText(aboutHtml) ? [aboutHtml] : [],
    sports: picked.sports,
    primarySport: picked.sports[0] ?? null,
    city,
    citySlug: city ? cityCatalogSlug(city) ?? "" : "",
    district: data.district,
    trainingPlaces: places,
    address: mirror.address,
    addressLat: mirror.addressLat,
    addressLng: mirror.addressLng,
    geocodeStatus: mirror.geocodeStatus,
    priceFrom: data.priceFrom,
    phone: row.ownerUserId ? row.phone : phoneOrEmpty(data.phone),
    instagramUrl: data.instagram,
    telegram: data.telegram,
    email: row.ownerUserId ? row.email : data.email,
    experienceYears: data.experienceYears,
    formats: [...new Set(data.formats)],
    audiences: effectiveAudiences(data.audiences),
    status: publish ? "published" as const : data.status,
    updatedAt: new Date(),
  };
  await getDb().update(trainerProfiles).set(values).where(eq(trainerProfiles.id, row.id));
  void writeLog({
    level: "info",
    domain: "catalog",
    action: publish ? "catalog.trainer_publish" : "catalog.trainer_save",
    outcome: "success",
    message: publish ? "Тренер опубликовал профиль по ссылке." : "Профиль сохранён по ссылке.",
    target: row.slug,
  });
  return {
    ok: true as const,
    published: publish,
    message: savedWithMapNotice(
      publish ? "Профиль опубликован." : "Профиль скрыт. В каталоге его нет.",
      places,
    ),
  };
}

export const saveMagicTrainerFn = createServerFn({ method: "POST" })
  .validator(cardSchema)
  .handler(async ({ data }) => saveFromCookie(data, false));

export const publishMagicTrainerFn = createServerFn({ method: "POST" })
  .validator(cardSchema)
  .handler(async ({ data }) => saveFromCookie(data, true));

/** Short Instagram link: open the profile and keep the editor cookie. */
export const enterTrainerDoorFn = createServerFn({ method: "GET" })
  .validator(z.object({ code: doorCodeSchema }))
  .handler(async ({ data }) => {
    const row = await doorByCode(data.code);
    if (!row) return null;
    const published = row.status === "published";
    if (!published) {
      setCookie(PREVIEW_COOKIE, row.slug, cookieOptions());
      setCookie(EDIT_COOKIE, row.id, cookieOptions());
    }
    void writeLog({
      level: "info",
      domain: "catalog",
      action: "catalog.trainer_preview",
      outcome: "success",
      message: published ? "Короткая ссылка ведёт в каталог." : "Короткая ссылка открыла профиль.",
      target: row.slug,
    });
    return { slug: row.slug, published };
  });

const doorEmailSchema = z.object({
  email: z.string().trim().email("Введите корректный e-mail").max(320),
});

async function attachDoorProfile(profileId: string, userId: string, email: string) {
  const now = new Date();
  const updated = await getDb()
    .update(trainerProfiles)
    .set({
      ownerUserId: userId,
      claimStatus: "claimed",
      claimedAt: now,
      email,
      emailVerifiedAt: now,
      updatedAt: now,
    })
    .where(and(eq(trainerProfiles.id, profileId), isNull(trainerProfiles.ownerUserId)))
    .returning({ id: trainerProfiles.id });
  if (updated.length === 0) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
}

const DOOR_PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOOR_SLUG = /^[a-z0-9._]{1,30}$/;

export type DoorGoogleClaim = "claimed" | "own" | "missing" | "taken" | "busy";

/** Google on the short link proves the mailbox and binds the imported card. No password step. */
export async function claimDoorAfterGoogle(input: {
  userId: string;
  email: string;
  created: boolean;
  profileId: string;
  previewSlug: string;
}): Promise<DoorGoogleClaim> {
  const profileId = input.profileId.trim();
  const previewSlug = input.previewSlug.trim().toLowerCase();
  if (!DOOR_PROFILE_ID.test(profileId) || !DOOR_SLUG.test(previewSlug)) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Короткая ссылка не привязала профиль.",
      subject: input.email,
      actorUserId: input.userId,
    });
    return "missing";
  }

  const db = getDb();
  const [row] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, profileId)).limit(1);
  const open = Boolean(row?.previewToken) && row?.slug === previewSlug && row?.status !== "published";
  if (!row || !open) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Короткая ссылка не привязала профиль.",
      subject: input.email,
      actorUserId: input.userId,
      target: previewSlug,
    });
    return "missing";
  }
  if (row.ownerUserId === input.userId) return "own";
  if (row.ownerUserId) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Этот профиль уже привязан.",
      subject: input.email,
      actorUserId: input.userId,
      target: row.slug,
    });
    return "taken";
  }

  const [other] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(and(eq(trainerProfiles.ownerUserId, input.userId), ne(trainerProfiles.id, row.id)))
    .limit(1);
  if (other) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "У этого аккаунта уже есть другая карточка.",
      subject: input.email,
      actorUserId: input.userId,
      target: row.slug,
    });
    return "busy";
  }

  const now = new Date();
  const email = normalizeEmail(input.email);
  const updated = await db
    .update(trainerProfiles)
    .set({
      ownerUserId: input.userId,
      claimStatus: "claimed",
      claimedAt: now,
      email,
      emailVerifiedAt: now,
      updatedAt: now,
    })
    .where(and(eq(trainerProfiles.id, row.id), isNull(trainerProfiles.ownerUserId)))
    .returning({ id: trainerProfiles.id });
  if (updated.length === 0) {
    const [again] = await db
      .select({ ownerUserId: trainerProfiles.ownerUserId })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.id, row.id))
      .limit(1);
    return again?.ownerUserId === input.userId ? "own" : "taken";
  }

  await db.insert(userRoles).values({ userId: input.userId, role: "trainer" }).onConflictDoNothing();
  if (input.created) {
    const firstName = row.firstName.trim();
    const lastName = row.lastName.trim();
    await db.update(users).set({
      ...(firstName ? { firstName } : {}),
      lastName: lastName || null,
      lastSignupIntent: "trainer_claim",
      updatedAt: now,
    }).where(eq(users.id, input.userId));
  }

  void writeLog({
    level: "info",
    domain: "account",
    action: "account.claim",
    outcome: "success",
    message: "Google привязал импортированный профиль. Почта подтверждена.",
    subject: email,
    actorUserId: input.userId,
    target: row.slug,
  });

  const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
  await sendTrainerWelcome({ id: input.userId, firstName: row.firstName.trim() || "Тренер" });
  return "claimed";
}

async function openDoorSession(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
  const opened = await beginLogin(user, { remember: true });
  if ("totpTicket" in opened) {
    setTotpTicketCookie(opened.totpTicket);
    return "/auth/totp";
  }
  setSessionCookie(opened.token, true);
  return "/me";
}

export const requestDoorEmailFn = createServerFn({ method: "POST" })
  .validator(doorEmailSchema)
  .handler(async ({ data }) => {
    const row = await profileFromEditCookie();
    if (!row || row.status === "published") {
      throw new AuthError("Ссылка на редактирование уже не действует.", "VALIDATION");
    }
    if (row.ownerUserId) throw new AuthError("Этот профиль уже привязан. Войдите в аккаунт.", "VALIDATION");
    if (!row.previewToken || getCookie(PREVIEW_COOKIE) !== row.slug) {
      throw new AuthError("Ссылка на редактирование уже не действует.", "VALIDATION");
    }
    const email = normalizeEmail(data.email);
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    const limit = await consumeRateLimit(`door-email:${row.id}:${ip}`, 60_000, 1);
    if (!limit.ok) throw new AuthError(`Код можно отправить снова через ${limit.retryAfterSec} с.`, "RATE_LIMITED");

    const db = getDb();
    const now = new Date();
    const linkToken = generateSecureToken();
    await db
      .update(authDoorClaims)
      .set({ usedAt: now })
      .where(and(eq(authDoorClaims.profileId, row.id), isNull(authDoorClaims.usedAt)));
    await db.insert(authDoorClaims).values({
      profileId: row.id,
      email,
      tokenHash: hashToken(`${row.id}:${linkToken}`),
      expiresAt: addMinutes(now, 60),
    });
    const origin = requestOrigin();
    const link = `${origin}/hi/${row.previewToken}?mail=${encodeURIComponent(linkToken)}`;
    try {
      const letter = renderLetter({
        service: true,
        title: "Ваш профиль",
        person: {
          name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Тренер",
          avatarUrl: row.avatarPath,
          caption: "Ваш профиль",
        },
        lines: ["Ссылка действует один час и сразу открывает вашу страницу."],
        action: { href: link, label: "Открыть профиль" },
        note: "Если вы не запрашивали это письмо, просто удалите его.",
      });
      await sendMail({
        to: [email],
        subject: "Ваш профиль на trenio.by",
        text: letter.text,
        html: letter.html,
      });
    } catch (error) {
      logCaught("email", "email.send", error, { subject: email, target: row.slug });
      throw new AuthError("Письмо не отправилось. Попробуйте ещё раз.", "VALIDATION");
    }
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.send",
      outcome: "success",
      message: "Ссылка на профиль отправлена на почту.",
      subject: email,
      target: row.slug,
    });
    return { ok: true as const, message: "Ссылка отправлена." };
  });

export const confirmDoorEmailFn = createServerFn({ method: "POST" })
  .validator(doorEmailSchema.extend({ code: z.string().trim().min(4).max(12) }))
  .handler(async () => {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  });

async function freshDoorClaim(code: string, token: string) {
  const row = await doorByCode(code);
  if (!row) return null;
  const now = new Date();
  const [claim] = await getDb()
    .select()
    .from(authDoorClaims)
    .where(
      and(
        eq(authDoorClaims.profileId, row.id),
        eq(authDoorClaims.tokenHash, hashToken(`${row.id}:${token}`)),
        isNull(authDoorClaims.usedAt),
        gt(authDoorClaims.expiresAt, now),
      ),
    )
    .limit(1);
  if (!claim) return null;
  return { row, claim };
}

export const peekTrainerMailFn = createServerFn({ method: "GET" })
  .validator(z.object({ code: doorCodeSchema, token: z.string().trim().min(20).max(200) }))
  .handler(async ({ data }) => {
    const found = await freshDoorClaim(data.code, data.token);
    return found ? { ok: true as const } : null;
  });

export const openTrainerMailFn = createServerFn({ method: "POST" })
  .validator(z.object({ code: doorCodeSchema, token: z.string().trim().min(20).max(200) }))
  .handler(async ({ data }) => {
    const found = await freshDoorClaim(data.code, data.token);
    if (!found) throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");
    const { row, claim } = found;
    if (row.ownerUserId) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
    const now = new Date();
    const [spent] = await getDb()
      .update(authDoorClaims)
      .set({ usedAt: now })
      .where(and(eq(authDoorClaims.id, claim.id), isNull(authDoorClaims.usedAt)))
      .returning({ id: authDoorClaims.id });
    if (!spent) throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");

    const email = claim.email;
    let user = await findUserByEmail(email);
    if (user && (user.status === "deleted" || user.status === "suspended")) {
      throw new AuthError("Ссылка уже не действует.", "VALIDATION");
    }
    if (!user) {
      const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
      const [created] = await getDb()
        .insert(users)
        .values({
          email,
          passwordHash,
          emailVerifiedAt: now,
          firstName: row.firstName || "Тренер",
          lastName: row.lastName || null,
          status: "active",
          lastSignupIntent: "trainer_claim",
          needsPassword: true,
        })
        .returning();
      user = created;
      await getDb().insert(userRoles).values({ userId: user.id, role: "trainer" });
    }
    await attachDoorProfile(row.id, user.id, email);
    await openDoorSession(user.id);
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.claim",
      outcome: "success",
      message: "Письмо открыло профиль. Почта подтверждена.",
      subject: email,
      actorUserId: user.id,
      target: row.slug,
    });
    return { ok: true as const, slug: row.slug, needsPassword: user.needsPassword };
  });
/** Password chosen in the cabinet after the magic-link mail. That step finishes the account. */
export const setDoorPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(z.object({
    password: z.string().min(1).max(128),
    passwordConfirm: z.string().min(1).max(128),
  }))
  .handler(async ({ data, context }) => {
    if (data.password !== data.passwordConfirm) throw new AuthError("Пароли не совпадают.", "VALIDATION");
    const policyError = validatePasswordStrength(data.password);
    if (policyError) throw new AuthError(policyError, "WEAK_PASSWORD");
    if (context.user.lastSignupIntent !== "trainer_claim" || !context.user.needsPassword) {
      throw new AuthError("Пароль уже задан.", "VALIDATION");
    }
    const [owned] = await getDb().select({
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      avatarPath: trainerProfiles.avatarPath,
    }).from(trainerProfiles).where(eq(trainerProfiles.ownerUserId, context.user.id)).limit(1);
    if (!owned) throw new AuthError("Пароль уже задан.", "VALIDATION");

    await getDb().update(users).set({
      passwordHash: await hashPassword(data.password),
      needsPassword: false,
      updatedAt: new Date(),
    }).where(eq(users.id, context.user.id));
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.password",
      outcome: "success",
      message: "Тренер задал пароль по короткой ссылке.",
      subject: context.user.email,
      actorUserId: context.user.id,
      target: owned.slug,
    });

    const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
    await sendTrainerWelcome({ id: context.user.id, firstName: owned.firstName || context.user.firstName });

    let mailed = false;
    try {
      const letter = renderLetter({
        service: true,
        title: "Поздравляем!",
        lead: "Мы создали ваш аккаунт. Рады, что вы теперь с нами.",
        person: {
          name: [owned.firstName, owned.lastName].filter(Boolean).join(" ") || "Тренер",
          avatarUrl: owned.avatarPath,
          caption: "Ваш профиль",
        },
        lines: [
          "Пароль сохранён, кабинет тренера открыт.",
          "Дальше работаем вместе: профиль, люди, которые вас ищут, и всё, что захочется поправить. Если появится вопрос, просто напишите нам.",
          "Спасибо!",
        ],
        action: { href: `${requestOrigin()}/trainers/${owned.slug}`, label: "Открыть профиль" },
      });
      await sendMail({
        to: [context.user.email],
        subject: "Поздравляем, аккаунт создан · trenio.by",
        text: letter.text,
        html: letter.html,
      });
      mailed = true;
      void writeLog({
        level: "info",
        domain: "email",
        action: "email.send",
        outcome: "success",
        message: "Письмо о создании аккаунта отправлено.",
        subject: context.user.email,
        actorUserId: context.user.id,
        target: owned.slug,
      });
    } catch (error) {
      logCaught("email", "email.send", error, { subject: context.user.email, target: owned.slug });
    }
    return {
      ok: true as const,
      mailed,
      slug: owned.slug,
      message: "Дальше можно работать со своим аккаунтом.",
    };
  });
