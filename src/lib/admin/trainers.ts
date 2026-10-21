import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
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
import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { getPublishedTrainer, PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import { popularityScore } from "@/lib/catalog/trainer-popularity";
import { getSportTaxonomyChild, listSecondLevelSports, MAX_TRAINER_SPORTS, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";

export const TRAINER_PUBLISH_STATUSES = ["draft", "published", "hidden", "archived"] as const;
export type TrainerPublishStatus = (typeof TRAINER_PUBLISH_STATUSES)[number];

export const TRAINER_PUBLISH_LABEL: Record<TrainerPublishStatus, string> = {
  draft: "На модерации",
  published: "Опубликован",
  hidden: "Скрыт",
  archived: "В архиве",
};

export type AdminTrainerAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  roles: UserRole[];
};

export type AdminTrainer = {
  id: string | null;
  slug: string;
  status: TrainerPublishStatus;
  fullName: string;
  headline: string;
  bio: string;
  about: string;
  sports: string;
  sportSlugs: string[];
  city: string;
  district: string;
  priceFrom: number;
  languages: string;
  phone: string;
  instagram: string;
  telegram: string;
  experienceYears: number;
  avatarPath: string;
  createdAt: string;
  reviews: number;
  rating: string;
  popularity: number;
  catalog: boolean;
  account: AdminTrainerAccount | null;
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
    const slug = getSportTaxonomyChild(sport.slug)?.slug ?? childSlugByLabel.get(sport.label.toLowerCase());
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return {
    sportSlugs: slugs,
    sports: slugs.map((slug) => getSportTaxonomyChild(slug)?.label ?? slug).join(", "),
  };
}

function decodeJpeg(image: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(image);
  if (!match) throw new AuthError("Фото должно быть изображением JPEG, PNG или WebP.", "VALIDATION");
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buffer.length > 1_500_000) throw new AuthError("Фото больше 1,5 МБ.", "VALIDATION");
  return buffer;
}

export const MAX_TRAINER_CERTIFICATES = 12;

async function editableTrainer(slug: string, user: { id: string; roles: UserRole[] }) {
  const [row] = await getDb().select().from(trainerProfiles).where(eq(trainerProfiles.slug, slug)).limit(1);
  if (!row) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
  if (!isStaff(user.roles) && row.ownerUserId !== user.id) {
    throw new AuthError("Эту карточку нельзя изменить.", "FORBIDDEN");
  }
  return row;
}

async function writeTrainerImage(slug: string, folder: string, image: string) {
  const buffer = decodeJpeg(image);
  const dir = path.join(process.cwd(), "public", "trainers", "admin", slug, folder);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(3).toString("hex")}.jpg`;
  await writeFile(path.join(dir, name), buffer);
  return `/trainers/admin/${slug}/${folder}/${name}`;
}

async function removeTrainerFile(slug: string, stored: string) {
  const prefix = `/trainers/admin/${slug}/`;
  if (!stored.startsWith(prefix)) return;
  await unlink(path.join(process.cwd(), "public", stored)).catch(() => undefined);
}

function versioned(items: string[]) {
  const version = Date.now();
  return items.map((item) => `${item.split("?")[0]}?v=${version}`);
}

function handleFrom(raw: string, fallback: string) {
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl || raw.replace(/^@/, "")).replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  return handle || fallback.replace(/[^a-z0-9._]/gi, "").slice(0, 30);
}

export const MAX_TRAINER_PHOTOS = 9;

const saveSchema = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().trim().min(1).max(18),
  status: z.enum(TRAINER_PUBLISH_STATUSES),
  fullName: z.string().trim().max(200),
  headline: z.string().trim().max(200),
  bio: z.string().trim().max(4000),
  about: z.string().trim().max(8000),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  district: z.string().trim().max(120),
  priceFrom: z.number().int().min(1).max(1_000_000),
  phone: z.string().trim().max(32),
  instagram: z.string().trim().max(300),
  telegram: z.string().trim().max(300),
  experienceYears: z.number().int().min(1).max(80),
});

function trainerStats(slug: string, ratings: Map<string, { reviews: number; average: number }>) {
  const row = ratings.get(slug);
  const reviews = row?.reviews ?? 0;
  const average = row?.average ?? 0;
  const rating = reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : "0";
  return { reviews, rating, popularity: popularityScore({ rating, reviews }) };
}

function isCatalog(slug: string) {
  return PUBLISHED_TRAINERS.some((trainer) => trainer.slug === slug);
}

export const getAdminTrainersFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<AdminTrainer[]> => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [profileRows, ratingRows] = await Promise.all([
      db
      .select({
        id: trainerProfiles.id,
        slug: trainerProfiles.slug,
        status: trainerProfiles.status,
        fullName: trainerProfiles.fullName,
        headline: trainerProfiles.headline,
        bio: trainerProfiles.bio,
        about: trainerProfiles.about,
        sports: trainerProfiles.sports,
        city: trainerProfiles.city,
        district: trainerProfiles.district,
        priceFrom: trainerProfiles.priceFrom,
        languages: trainerProfiles.languages,
        phone: trainerProfiles.phone,
        instagramUrl: trainerProfiles.instagramUrl,
        telegram: trainerProfiles.telegram,
        experienceYears: trainerProfiles.experienceYears,
        avatarPath: trainerProfiles.avatarPath,
        createdAt: trainerProfiles.createdAt,
        ownerId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        accountPhone: users.phone,
        accountStatus: users.status,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId)),
      db
        .select({
          slug: trainerReviews.trainerSlug,
          reviews: count(),
          average: avg(trainerReviews.rating),
        })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "published"))
        .groupBy(trainerReviews.trainerSlug),
    ]);
    const ratings = new Map(ratingRows.map((row) => [row.slug, { reviews: Number(row.reviews), average: Number(row.average) }]));

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
      fullName: row.fullName,
      headline: row.headline,
      bio: row.bio,
      about: row.about.join("\n\n"),
      ...sportSelection(row.sports),
      city: row.city,
      district: row.district,
      priceFrom: Math.max(1, row.priceFrom ?? 1),
      languages: row.languages.join(", "),
      phone: row.phone,
      instagram: row.instagramUrl,
      telegram: row.telegram,
      experienceYears: row.experienceYears,
      avatarPath: row.avatarPath,
      createdAt: row.createdAt.toISOString(),
      ...trainerStats(row.slug, ratings),
      catalog: isCatalog(row.slug),
      account: row.ownerId && !hidden.has(row.ownerId)
        ? {
            id: row.ownerId,
            name: [row.firstName, row.lastName].filter(Boolean).join(" "),
            email: row.email ?? "",
            phone: row.accountPhone ?? "",
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
      fullName: trainer.name,
      headline: "",
      bio: trainer.bio,
      about: "",
      ...sportSelection(trainer.sports),
      city: trainer.city.label,
      district: trainer.district,
      priceFrom: 1,
      languages: "",
      phone: trainer.phone,
      instagram: trainer.instagram,
      telegram: "",
      experienceYears: trainer.experience ?? 0,
      avatarPath: trainer.photo,
      createdAt: "",
      ...trainerStats(trainer.slug, ratings),
      catalog: true,
      account: null,
    }));

    return [...fromDb, ...fromCatalog].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
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

    const parts = data.fullName.split(/\s+/).filter(Boolean);
    const published = getPublishedTrainer(data.slug);
    const picked = trainerSportsFromSlugs(data.sportSlugs);
    if (picked.slugs.length > MAX_TRAINER_SPORTS) {
      throw new AuthError("Можно выбрать не больше четырёх видов спорта.", "VALIDATION");
    }
    if (picked.sports.length !== picked.slugs.length) {
      throw new AuthError("Выберите вид спорта из списка категорий.", "VALIDATION");
    }
    const sports: TrainerSportRecord[] = picked.sports;
    const city = await assertBelarusCity(data.city);
    const values = {
      firstName: (parts[0] ?? "").slice(0, 100),
      lastName: parts.slice(1).join(" ").slice(0, 100),
      fullName: data.fullName.slice(0, 200),
      headline: data.headline,
      bio: data.bio,
      about: data.about.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
      sports,
      primarySport: sports[0] ?? null,
      city,
      citySlug: city ? slugify(city) : "",
      district: data.district,
      priceFrom: data.priceFrom,
      phone: data.phone,
      instagramUrl: data.instagram,
      telegram: data.telegram,
      experienceYears: data.experienceYears,
      status: data.status,
      updatedAt: new Date(),
    };

    try {
      if (existing) {
        const handle = handleFrom(data.instagram, existing.instagramHandle);
        await db.update(trainerProfiles).set({
          ...values,
          instagramHandle: handle || existing.instagramHandle,
        }).where(eq(trainerProfiles.id, existing.id));
      } else {
        const claimToken = randomBytes(32).toString("base64url");
        await db.insert(trainerProfiles).values({
          ...values,
          slug: data.slug,
          instagramHandle: handleFrom(data.instagram, data.slug),
          sourceUrl: data.instagram || `https://trenio.by/trainers/${data.slug}`,
          claimStatus: "unclaimed",
          createdSource: "admin_created",
          audiences: published?.audiences ?? [],
          formats: published?.formats ?? [],
          avatarPath: published?.photo ?? "",
          claimToken,
          claimPath: `/trainers/claim/${claimToken}`,
        });
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      const code = (error as { code?: string; cause?: { code?: string } }).code
        ?? (error as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        throw new AuthError("Такой адрес Instagram или адрес карточки уже занят.", "VALIDATION");
      }
      console.error(error);
      throw new AuthError("Не удалось сохранить профиль.", "VALIDATION");
    }

    return { ok: true as const, message: "Профиль тренера сохранён." };
  });

const slugSchema = z.string().trim().min(1).max(18).regex(/^[a-z0-9-]+$/);

const CLAIM_LABEL = { unclaimed: "Не забран", claimed: "Привязан к аккаунту", disputed: "Спор" } as const;
const SOURCE_LABEL = { self: "Сам тренер", branch_created: "Филиал", admin_created: "Администратор", import: "Импорт" } as const;
const AUDIENCE_LABEL = { adult: "Взрослые", teen: "Подростки", kid: "Дети" } as const;
const FORMAT_LABEL = { individual: "Индивидуально", group: "Группа" } as const;
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
  sourceBio: string;
  audiences: string;
  formats: string;
  pinnedPosts: Array<{ url: string; caption: string }>;
  createdAt: string;
  updatedAt: string;
  claimedAt: string;
  linked: boolean;
  accountName: string;
  accountEmail: string;
  accountPhone: string;
  accountRoles: string;
  accountStatus: string;
  lastLoginAt: string;
};

export type AdminTrainerDetail = {
  trainer: AdminTrainer;
  photos: string[];
  certificates: string[];
  logins: AdminTrainerLogin[];
  logs: AdminTrainerLog[];
  facts: AdminTrainerFacts;
};

export const getAdminTrainerDetailFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data, context }): Promise<AdminTrainerDetail | null> => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [row] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.slug, data.slug)).limit(1);
    if (!row) return null;

    const hidden = await hiddenStaffIds(context.user.roles);
    const ownerVisible = Boolean(row.ownerUserId) && !hidden.has(row.ownerUserId ?? "");
    const [ratingRows, reviewRows, owner, roleRows] = await Promise.all([
      db
        .select({ reviews: count(), average: avg(trainerReviews.rating) })
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
              firstName: users.firstName,
              lastName: users.lastName,
              phone: users.phone,
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

    return {
      trainer: {
        id: row.id,
        slug: row.slug,
        status: row.status,
        fullName: row.fullName,
        headline: row.headline,
        bio: row.bio,
        about: row.about.join("\n\n"),
        ...sportSelection(row.sports),
        city: row.city,
        district: row.district,
        priceFrom: Math.max(1, row.priceFrom ?? 1),
        languages: row.languages.join(", "),
        phone: row.phone,
        instagram: row.instagramUrl,
        telegram: row.telegram,
        experienceYears: row.experienceYears,
        avatarPath: row.avatarPath ? `${row.avatarPath}?v=${version}` : "",
        createdAt: row.createdAt.toISOString(),
        reviews,
        rating: reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : "0",
        popularity: popularityScore({ rating: reviews > 0 ? average.toFixed(1) : "0", reviews }),
        catalog: isCatalog(row.slug),
        account: owner
          ? {
              id: owner.id,
              name: [owner.firstName, owner.lastName].filter(Boolean).join(" "),
              email: owner.email,
              phone: owner.phone ?? "",
              status: owner.status,
              roles,
            }
          : null,
      },
      photos: (row.photos.length > 0 ? row.photos : row.avatarPath ? [row.avatarPath] : []).map((item) => `${item}?v=${version}`),
      certificates: row.certificates.map((item) => `${item}?v=${version}`),
      logins: loginRows.map((login) => ({
        id: login.id,
        createdAt: login.createdAt.toISOString(),
        expiresAt: login.expiresAt.toISOString(),
        ip: login.ipAddress || "—",
        userAgent: login.userAgent || "—",
        active: login.expiresAt.getTime() > now,
      })),
      logs: logs.slice(0, 60),
      facts: {
        claimStatus: CLAIM_LABEL[row.claimStatus],
        createdSource: SOURCE_LABEL[row.createdSource],
        instagramHandle: row.instagramHandle,
        telegram: row.telegram,
        sourceBio: row.sourceBio,
        audiences: row.audiences.map((item) => AUDIENCE_LABEL[item]).join(", "),
        formats: row.formats.map((item) => FORMAT_LABEL[item]).join(", "),
        pinnedPosts: row.pinnedPosts.map((post) => ({ url: post.url, caption: post.caption })),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        claimedAt: row.claimedAt ? row.claimedAt.toISOString() : "",
        linked: Boolean(owner),
        accountName: owner ? [owner.firstName, owner.lastName].filter(Boolean).join(" ") : "",
        accountEmail: owner?.email ?? "",
        accountPhone: owner?.phone ?? "",
        accountRoles: roles.join(", "),
        accountStatus: owner ? ACCOUNT_STATUS_LABEL[owner.status] ?? owner.status : "",
        lastLoginAt: owner?.lastLoginAt ? owner.lastLoginAt.toISOString() : "",
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
    const base = row.photos.length > 0 ? row.photos : row.avatarPath ? [row.avatarPath.split("?")[0]] : [];
    if (base.length >= MAX_TRAINER_PHOTOS) {
      throw new AuthError("Можно загрузить не больше девяти фото.", "VALIDATION");
    }
    const stored = await writeTrainerImage(data.slug, "photos", data.image);
    const photos = [...base, stored];
    await getDb().update(trainerProfiles).set({
      photos,
      avatarPath: photos[0] ?? "",
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, row.id));
    return { ok: true as const, photo: versioned([stored])[0], photos: versioned(photos) };
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
    await getDb().update(trainerProfiles).set({
      photos: next,
      avatarPath: next[0] ?? "",
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, row.id));
    return { ok: true as const, photos: versioned(next) };
  });

export const addAdminTrainerCertificateFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(imageSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    if (row.certificates.length >= MAX_TRAINER_CERTIFICATES) {
      throw new AuthError("Можно загрузить не больше двенадцати документов.", "VALIDATION");
    }
    const stored = await writeTrainerImage(data.slug, "certificates", data.image);
    const certificates = [...row.certificates, stored];
    await getDb().update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
    return { ok: true as const, certificate: versioned([stored])[0], certificates: versioned(certificates) };
  });

export const removeAdminTrainerCertificateFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(pathSchema)
  .handler(async ({ data, context }) => {
    const row = await editableTrainer(data.slug, context.user);
    const target = data.path.split("?")[0];
    const certificates = row.certificates.filter((item) => item !== target);
    await removeTrainerFile(data.slug, target);
    await getDb().update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
    return { ok: true as const, certificates: versioned(certificates) };
  });
