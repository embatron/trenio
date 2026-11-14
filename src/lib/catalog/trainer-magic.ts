import { randomBytes, randomUUID } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { and, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

import { optionalAuthMiddleware, requireAuthMiddleware, requireSessionMiddleware } from "@/auth/middleware";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { GENERIC_OTP_ERROR, issueOtp, verifyOtp } from "@/auth/otp";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
import { isSmsByEnabled } from "@/auth/sms";
import { hashPassword, normalizeEmail, validatePasswordStrength } from "@/auth/password";
import { setSessionCookie, setTotpTicketCookie } from "@/auth/session";
import { beginLogin, findUserByEmail } from "@/auth/service";
import { addMinutes, generateSecureToken, hashToken } from "@/auth/tokens";
import { getDb } from "@/db";
import { authDoorClaims, trainerProfiles, userRoles, users, type TrainerProfile } from "@/db/schema";
import { renderLetter } from "@/lib/mail/letter";
import { mailTransportReady, sendMail } from "@/lib/mail/send.server";
import { assertStaff } from "@/lib/admin/access";
import { copyCardFaceToAccount } from "@/lib/catalog/account-face";
import { AuthError } from "@/lib/auth/errors";
import { formatBelarusPhone, normalizeBelarusMobile, storedBelarusPhone, validateBelarusMobile } from "@/lib/auth/phone";
import { belarusPhoneEquals } from "@/lib/auth/phone-match";
import { isPendingSignupEmail, pendingSignupEmail } from "@/lib/auth/pending-email";
import { isStaff } from "@/lib/auth/roles";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { readCertificates } from "@/lib/catalog/certificate-file";
import { sanitizeReviewHtml, reviewPlainText } from "@/lib/catalog/review-html";
import { publicTrainerCityLabel } from "@/lib/catalog/trainer-city";
import { relayDoorMark } from "@/lib/sync/relay";
import { ensurePublicDoorLink } from "@/lib/catalog/trainer-outreach";
import { publishConfirmedDraft } from "@/lib/catalog/trainer-door-claim";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import {
  effectiveAudiences,
  type PublishedTrainer,
  type TrainerAudience,
  type TrainerFormat,
} from "@/lib/catalog/published-trainers";
import { MAX_TRAINER_SPORTS, trainerSportSlugs, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { appOrigin } from "@/lib/app-origin";
import { placesFromProfile, placesShape, savedWithMapNotice } from "@/lib/geo/schemas";
import { logCaught, maskPhone, writeLog } from "@/lib/log/logger";

const PREVIEW_COOKIE = "trenio_trainer_preview";
const EDIT_COOKIE = "trenio_trainer_edit";
/** Preview and edit cookies on the short link. Not the letter button. */
const LINK_MAX_AGE = 60 * 30;
/** The mailbox button in «Ваш профиль». A newer letter retires the previous one. */
const DOOR_MAIL_HOURS = 24;

function requestOrigin() {
  const fallback = appOrigin();
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return fallback;
  }
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

function profileToPublished(row: TrainerProfile): PublishedTrainer {
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
  const cityLabel = publicTrainerCityLabel(row);
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
    headline: row.headline,
    audiences: effectiveAudiences(row.audiences),
    formats: row.formats,
    phone: row.phone,
    instagram: row.instagramUrl,
    telegram: row.telegram,
    email: row.email,
    experience: row.experienceYears,
    priceFrom: row.priceFrom ?? 0,
    district: row.district,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
      status: trainerProfiles.status,
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
        message: "Профиль уже опубликован. Ссылка не копируется.",
        actorUserId: context.user.id,
        target: data.slug,
      });
      throw new AuthError("Профиль уже опубликован. Ссылка больше не копируется.", "VALIDATION");
    }
    let url = "";
    try {
      url = await ensurePublicDoorLink(row.slug);
    } catch (error) {
      logCaught("admin", "admin.trainer_invite", error, { actorUserId: context.user.id, target: row.slug });
      throw new AuthError("Короткая ссылка не записалась на сервер. Повторите.", "VALIDATION");
    }
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.trainer_invite",
      outcome: "success",
      message: "Скопирована короткая ссылка на профиль.",
      actorUserId: context.user.id,
      target: row.slug,
    });
    return { url };
  });

export const markTrainerInviteSentFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [row] = await db
      .select({
        id: trainerProfiles.id,
        status: trainerProfiles.status,
        handle: trainerProfiles.instagramHandle,
        previewToken: trainerProfiles.previewToken,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!row) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
    if (row.status === "published") {
      throw new AuthError("Профиль уже опубликован. Ссылка больше не копируется.", "VALIDATION");
    }
    const sentAt = new Date();
    await db.update(trainerProfiles).set({ inviteSentAt: sentAt }).where(eq(trainerProfiles.id, row.id));
    await relayDoorMark({
      handle: row.handle || data.slug,
      token: row.previewToken ?? "",
      linkAt: sentAt.toISOString(),
    });
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.trainer_invite_sent",
      outcome: "success",
      message: "Короткая ссылка отмечена отправленной.",
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
    doorEnteredAt: trainerProfiles.doorEnteredAt,
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
    await markDoorEntered(row);
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

async function openDoorProfile() {
  const row = await profileFromEditCookie();
  if (!row || row.status === "published") {
    throw new AuthError("Ссылка на редактирование уже не действует.", "VALIDATION");
  }
  if (row.ownerUserId) throw new AuthError("Этот профиль уже привязан. Войдите в аккаунт.", "VALIDATION");
  if (!row.previewToken || getCookie(PREVIEW_COOKIE) !== row.slug) {
    throw new AuthError("Ссылка на редактирование уже не действует.", "VALIDATION");
  }
  return row;
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
    const sports = trainerSportSlugs((row.sports ?? []).map((sport) => sport.slug));
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
  if (picked.sports.length > MAX_TRAINER_SPORTS) {
    throw new AuthError("Можно выбрать не больше четырёх видов спорта.", "VALIDATION");
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

async function markDoorEntered(row: { id: string; slug: string; doorEnteredAt: Date | null }) {
  if (row.doorEnteredAt) return;
  try {
    await getDb()
      .update(trainerProfiles)
      .set({ doorEnteredAt: new Date() })
      .where(and(eq(trainerProfiles.id, row.id), isNull(trainerProfiles.doorEnteredAt)));
  } catch (error) {
    logCaught("catalog", "catalog.trainer_preview", error, { target: row.slug });
  }
}

/** Short Instagram link: open the profile and keep the editor cookie. */
/** Short Instagram link: open the profile and keep the editor cookie. The visit does not publish the card. */
export const enterTrainerDoorFn = createServerFn({ method: "GET" })
  .validator(z.object({ code: doorCodeSchema }))
  .handler(async ({ data }) => {
    const row = await doorByCode(data.code);
    if (!row) return null;
    await markDoorEntered(row);
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
    .returning({
      id: trainerProfiles.id,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
    });
  if (updated.length === 0) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
  await getDb().insert(userRoles).values({ userId, role: "trainer" }).onConflictDoNothing();
  const card = updated[0];
  await copyCardFaceToAccount(userId, card.avatarPath, card.photos);
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
    const row = await openDoorProfile();
    const email = normalizeEmail(data.email);
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    const limit = await consumeRateLimit(`door-email:${row.id}:${ip}`, 60_000, 1);
    if (!limit.ok) throw new AuthError(`Код можно отправить снова через ${limit.retryAfterSec} с.`, "RATE_LIMITED");

    const db = getDb();
    const now = new Date();
    const linkToken = generateSecureToken();
    const retired = await db
      .select({ id: authDoorClaims.id })
      .from(authDoorClaims)
      .where(and(eq(authDoorClaims.profileId, row.id), isNull(authDoorClaims.usedAt)));
    const retiredIds = retired.map((item) => item.id);
    if (retiredIds.length > 0) {
      await db.update(authDoorClaims).set({ usedAt: now }).where(inArray(authDoorClaims.id, retiredIds));
    }
    const [created] = await db.insert(authDoorClaims).values({
      profileId: row.id,
      email,
      tokenHash: hashToken(`${row.id}:${linkToken}`),
      expiresAt: addMinutes(now, DOOR_MAIL_HOURS * 60),
    }).returning({ id: authDoorClaims.id });
    if (!created) {
      if (retiredIds.length > 0) {
        await db.update(authDoorClaims).set({ usedAt: null }).where(inArray(authDoorClaims.id, retiredIds));
      }
      throw new AuthError("Письмо не отправилось. Попробуйте ещё раз.", "VALIDATION");
    }
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
        lines: ["Ссылка действует 24 часа и сразу открывает вашу страницу."],
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
      await db.delete(authDoorClaims).where(eq(authDoorClaims.id, created.id));
      if (retiredIds.length > 0) {
        await db.update(authDoorClaims).set({ usedAt: null }).where(inArray(authDoorClaims.id, retiredIds));
      }
      logCaught("email", "email.send", error, { subject: email, target: row.slug });
      throw new AuthError("Письмо не отправилось. Попробуйте ещё раз.", "VALIDATION");
    }
    if (retiredIds.length > 0) {
      void writeLog({
        level: "info",
        domain: "email",
        action: "email.send",
        outcome: "success",
        message: "Новое письмо погасило предыдущую ссылку на профиль.",
        subject: email,
        target: row.slug,
        context: { retired: retiredIds.length },
      });
    }
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.send",
      outcome: "success",
      message: "Ссылка на профиль отправлена на почту.",
      subject: email,
      target: row.slug,
      context: { hours: DOOR_MAIL_HOURS },
    });
    return { ok: true as const, message: "Ссылка уже отправлена.", email };
  });

const doorPhoneSchema = z.object({
  phone: z.string().trim().min(4).max(32),
});

export const requestDoorPhoneFn = createServerFn({ method: "POST" })
  .validator(doorPhoneSchema)
  .handler(async ({ data }) => {
    const row = await openDoorProfile();
    const phoneError = validateBelarusMobile(data.phone);
    const phone = normalizeBelarusMobile(data.phone);
    if (phoneError || !phone) {
      throw new AuthError(phoneError ?? "Укажите мобильный номер РБ: +375 25, 29, 33 или 44.", "VALIDATION");
    }
    if (process.env.NODE_ENV === "production" && !isSmsByEnabled()) {
      throw new AuthError("СМС сейчас недоступны. Подтвердите почту.", "VALIDATION");
    }
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    const ipLimit = await consumeRateLimit(`door-phone:ip:${ip}`, RATE_LIMITS.otpIp.windowMs, RATE_LIMITS.otpIp.max);
    const phoneLimit = await consumeRateLimit(`door-phone:${phone}`, RATE_LIMITS.otpPhone.windowMs, RATE_LIMITS.otpPhone.max);
    const blocked = !phoneLimit.ok ? phoneLimit : !ipLimit.ok ? ipLimit : null;
    if (blocked) {
      throw new AuthError(`Код можно отправить снова через ${blocked.retryAfterSec} с.`, "RATE_LIMITED");
    }
    const [owner] = await getDb()
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(belarusPhoneEquals(users.phone, phone))
      .limit(1);
    if (owner && (owner.status === "deleted" || owner.status === "suspended")) {
      throw new AuthError("Этот номер нельзя использовать.", "VALIDATION");
    }
    const issued = await issueOtp({
      phone,
      purpose: "register",
      userId: owner?.id ?? null,
      send: true,
    });
    if (!issued.ok) {
      throw new AuthError(
        issued.code === "rate_limited" ? issued.error : "Не удалось отправить SMS. Попробуйте позже.",
        issued.code === "rate_limited" ? "RATE_LIMITED" : "VALIDATION",
      );
    }
    void writeLog({
      level: "info",
      domain: "sms",
      action: "sms.send",
      outcome: "success",
      message: "Код на короткую ссылку отправлен.",
      subject: maskPhone(phone),
      target: row.slug,
    });
    return { ok: true as const, retryAfterSec: issued.retryAfterSec, devCode: issued.devCode };
  });

export const confirmDoorPhoneFn = createServerFn({ method: "POST" })
  .validator(doorPhoneSchema.extend({ code: z.string().trim().min(4).max(12) }))
  .handler(async ({ data }) => {
    const row = await openDoorProfile();
    const phone = normalizeBelarusMobile(data.phone);
    const stored = phone ? storedBelarusPhone(phone) : null;
    if (!phone || !stored) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
    const verified = await verifyOtp({ phone, purpose: "register", code: data.code });
    if (!verified.ok) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

    const db = getDb();
    const [owner] = await db.select().from(users).where(belarusPhoneEquals(users.phone, phone)).limit(1);
    if (verified.userId) {
      if (!owner || owner.id !== verified.userId || owner.status === "deleted" || owner.status === "suspended") {
        throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
      }
    } else if (owner) {
      throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
    }

    let user = owner ?? null;
    const now = new Date();
    if (!user) {
      const id = randomUUID();
      const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
      const [created] = await db.insert(users).values({
        id,
        email: pendingSignupEmail(id),
        phone: stored,
        phoneVerifiedAt: now,
        passwordHash,
        firstName: row.firstName || "Тренер",
        lastName: row.lastName || null,
        status: "active",
        lastSignupIntent: "trainer_claim",
        needsPassword: true,
      }).returning();
      if (!created) throw new AuthError("Не удалось открыть кабинет. Попробуйте ещё раз.", "VALIDATION");
      user = created;
      await db.insert(userRoles).values({ userId: user.id, role: "user" });
    } else {
      const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
      if (isStaff(roles.map((item) => item.role))) {
        throw new AuthError("Этот номер нельзя использовать.", "VALIDATION");
      }
      const [other] = await db
        .select({ id: trainerProfiles.id })
        .from(trainerProfiles)
        .where(and(eq(trainerProfiles.ownerUserId, user.id), ne(trainerProfiles.id, row.id)))
        .limit(1);
      if (other) throw new AuthError("У этого аккаунта уже есть другая карточка.", "VALIDATION");
      const needsPassword = !user.passwordSetAt && !user.googleSub && !user.yandexSub;
      await db.update(users).set({
        phone: stored,
        phoneVerifiedAt: user.phoneVerifiedAt ?? now,
        status: user.status === "pending_verification" ? "active" : user.status,
        ...(needsPassword ? { needsPassword: true, lastSignupIntent: "trainer_claim" as const } : {}),
        updatedAt: now,
      }).where(eq(users.id, user.id));
      user = { ...user, needsPassword, phoneVerifiedAt: user.phoneVerifiedAt ?? now };
    }

    const updated = await db
      .update(trainerProfiles)
      .set({
        ownerUserId: user.id,
        claimStatus: "claimed",
        claimedAt: now,
        phone: stored,
        updatedAt: now,
      })
      .where(and(eq(trainerProfiles.id, row.id), isNull(trainerProfiles.ownerUserId)))
      .returning({
        id: trainerProfiles.id,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
      });
    if (updated.length === 0) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
    await db.insert(userRoles).values({ userId: user.id, role: "trainer" }).onConflictDoNothing();
    await copyCardFaceToAccount(user.id, updated[0].avatarPath, updated[0].photos);
    await publishConfirmedDraft(row);
    const next = await openDoorSession(user.id);
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.claim",
      outcome: "success",
      message: "Телефон открыл профиль. Номер подтверждён.",
      subject: maskPhone(phone),
      actorUserId: user.id,
      target: row.slug,
    });
    if (next === "/auth/totp") return { ok: true as const, slug: row.slug, needsPassword: false, redirectTo: next };
    return { ok: true as const, slug: row.slug, needsPassword: user.needsPassword, redirectTo: "/me" };
  });

export const confirmDoorEmailFn = createServerFn({ method: "POST" })
  .validator(doorEmailSchema.extend({ code: z.string().trim().min(4).max(12) }))
  .handler(async () => {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  });

type DoorMailFault = "missing" | "used" | "expired" | "owned" | "closed";

function noteDoorMailFault(reason: DoorMailFault, slug: string | null, subject: string | null) {
  const message = {
    missing: "Ссылка из письма не найдена.",
    used: "Ссылка из письма уже использована.",
    expired: "Ссылка из письма просрочена.",
    owned: "Ссылка из письма не открыла профиль: карточка уже привязана.",
    closed: "Ссылка из письма не открыла профиль: аккаунт закрыт.",
  }[reason];
  void writeLog({
    level: "warn",
    domain: "account",
    action: "account.claim",
    outcome: "denied",
    message,
    subject,
    target: slug,
    context: { reason },
  });
}

const doorMailSchema = z.object({
  code: z.string().trim().min(1).max(80),
  token: z.string().trim().min(1).max(500),
});

async function freshDoorClaim(code: string, token: string) {
  const parsed = doorCodeSchema.safeParse(code);
  if (!parsed.success) {
    noteDoorMailFault("missing", null, null);
    return null;
  }
  const row = await doorByCode(parsed.data);
  if (!row) {
    noteDoorMailFault("missing", null, null);
    return null;
  }
  const now = new Date();
  const [claim] = await getDb()
    .select()
    .from(authDoorClaims)
    .where(
      and(
        eq(authDoorClaims.profileId, row.id),
        eq(authDoorClaims.tokenHash, hashToken(`${row.id}:${token}`)),
      ),
    )
    .limit(1);
  if (!claim) {
    noteDoorMailFault("missing", row.slug, null);
    return null;
  }
  if (claim.usedAt) {
    noteDoorMailFault("used", row.slug, claim.email);
    return null;
  }
  if (claim.expiresAt.getTime() <= now.getTime()) {
    noteDoorMailFault("expired", row.slug, claim.email);
    return null;
  }
  if (row.ownerUserId) {
    noteDoorMailFault("owned", row.slug, claim.email);
    return null;
  }
  return { row, claim };
}

export const peekTrainerMailFn = createServerFn({ method: "GET" })
  .validator(doorMailSchema)
  .handler(async ({ data }) => {
    const found = await freshDoorClaim(data.code, data.token);
    if (!found) return null;
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.claim",
      outcome: "success",
      message: "Ссылка из письма ещё действует.",
      subject: found.claim.email,
      target: found.row.slug,
    });
    return { ok: true as const };
  });

export const openTrainerMailFn = createServerFn({ method: "POST" })
  .validator(doorMailSchema)
  .handler(async ({ data }) => {
    const found = await freshDoorClaim(data.code, data.token);
    if (!found) throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");
    const { row, claim } = found;
    if (row.ownerUserId) {
      noteDoorMailFault("owned", row.slug, claim.email);
      throw new AuthError("Ссылка уже не действует.", "VALIDATION");
    }
    const now = new Date();
    const [spent] = await getDb()
      .update(authDoorClaims)
      .set({ usedAt: now })
      .where(and(eq(authDoorClaims.id, claim.id), isNull(authDoorClaims.usedAt)))
      .returning({ id: authDoorClaims.id });
    if (!spent) {
      noteDoorMailFault("used", row.slug, claim.email);
      throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");
    }

    const email = claim.email;
    let user = await findUserByEmail(email);
    if (user && (user.status === "deleted" || user.status === "suspended")) {
      noteDoorMailFault("closed", row.slug, email);
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
    await publishConfirmedDraft(row);
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
/** Password chosen after the confirmation letter. The letter already published the card. */
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

    const now = new Date();
    await getDb().update(users).set({
      passwordHash: await hashPassword(data.password),
      passwordSetAt: now,
      needsPassword: false,
      updatedAt: now,
    }).where(eq(users.id, context.user.id));
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.password",
      outcome: "success",
      message: "Тренер задал пароль по короткой ссылке.",
      subject: isPendingSignupEmail(context.user.email) ? null : context.user.email,
      actorUserId: context.user.id,
      target: owned.slug,
    });

    const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
    await sendTrainerWelcome({ id: context.user.id, firstName: owned.firstName || context.user.firstName });

    let mailed = false;
    if (isPendingSignupEmail(context.user.email)) {
      return { ok: true as const, mailed, slug: owned.slug, message: "Дальше можно работать со своим аккаунтом." };
    }
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
