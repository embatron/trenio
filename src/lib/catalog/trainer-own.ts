import { randomBytes } from "node:crypto";
import path from "node:path";

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { hasAnyRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { readCertificates, type TrainerCertificate } from "@/lib/catalog/certificate-file";
import { effectiveAudiences, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { joinTrainerName, trainerNameParts } from "@/lib/catalog/trainer-name";
import { editorHtml, reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import { writeImageSet } from "@/lib/images/store";
import { MAX_TRAINER_SPORTS, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { placesFromProfile, placesShape, type TrainerPlace } from "@/lib/geo/schemas";

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value: string, max = 18) {
  const latin = value.toLowerCase().split("").map((char) => CYR[char] ?? char).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "") || "trainer";
}

export type OwnTrainerProfile = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  about: string;
  sportSlugs: string[];
  city: string;
  district: string;
  places: TrainerPlace[];
  priceFrom: number;
  phone: string;
  instagram: string;
  telegram: string;
  email: string;
  experienceYears: number;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
  avatarPath: string;
  slug: string;
  photos: string[];
  certificates: TrainerCertificate[];
  phoneVerified: boolean;
  offerAccepted: boolean;
  privacyAccepted: boolean;
};

const emptyProfile: OwnTrainerProfile = {
  firstName: "",
  lastName: "",
  headline: "",
  bio: "",
  about: "",
  sportSlugs: [],
  city: "",
  district: "",
  places: [],
  priceFrom: 1,
  phone: "",
  instagram: "",
  telegram: "",
  email: "",
  experienceYears: 1,
  formats: [],
  audiences: ["adult"],
  avatarPath: "",
  slug: "",
  photos: [],
  certificates: [],
  phoneVerified: false,
  offerAccepted: false,
  privacyAccepted: false,
};

const saveSchema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  headline: z.string().trim().max(200),
  bio: z.string().trim().max(4000),
  about: z.string().trim().max(8000),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  district: z.string().trim().max(120),
  ...placesShape,
  priceFrom: z.number().int().min(1).max(1_000_000),
  instagram: z.string().trim().max(300),
  telegram: z.string().trim().max(300),
  email: z.string().trim().max(320),
  experienceYears: z.number().int().min(1).max(80),
  formats: z.array(z.enum(["individual", "group"])).max(2),
  audiences: z.array(z.enum(["adult", "teen", "kid"])).max(3),
  image: z.string().max(2_200_000).optional(),
});

function assertTrainer(roles: UserRole[]) {
  if (!hasAnyRole(roles, ["trainer", "club"])) {
    throw new AuthError("Профиль тренера доступен роли тренера.", "FORBIDDEN");
  }
}

function instagramHandle(raw: string, userId: string) {
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl || raw.replace(/^@/, "")).replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  return handle || `self${userId.replace(/-/g, "").slice(0, 12)}`;
}

export const getOwnTrainerProfileFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertTrainer(context.user.roles);
    const db = getDb();
    const [account] = await db
      .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    const [row] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);
    const phone = formatBelarusPhone(account?.phone || row?.phone || "");
    const phoneVerified = account?.phoneVerifiedAt != null;
    if (!row) return { ...emptyProfile, phone, phoneVerified };
    const version = row.updatedAt.getTime();
    const name = trainerNameParts(row.firstName, row.lastName, row.fullName);
    return {
      firstName: name.firstName,
      lastName: name.lastName,
      headline: row.headline,
      bio: row.bio,
      about: editorHtml(row.about),
      sportSlugs: trainerSportsFromSlugs(row.sports.map((sport) => sport.slug)).slugs,
      city: row.city,
      district: row.district,
      places: placesFromProfile(row),
      priceFrom: Math.max(1, row.priceFrom ?? 1),
      phone,
      instagram: row.instagramUrl,
      telegram: row.telegram,
      email: row.email,
      experienceYears: Math.max(1, row.experienceYears || 1),
      formats: row.formats,
      audiences: effectiveAudiences(row.audiences),
      avatarPath: row.avatarPath,
      slug: row.slug,
      photos: (row.photos.length > 0 ? row.photos : row.avatarPath ? [row.avatarPath] : []).map((item) => `${item}?v=${version}`),
      certificates: readCertificates(row.certificates).map((item) => ({ ...item, path: `${item.path}?v=${version}` })),
      phoneVerified,
      offerAccepted: row.offerAcceptedAt != null,
      privacyAccepted: row.privacyAcceptedAt != null,
    };
  });

export const saveOwnTrainerProfileFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(saveSchema)
  .handler(async ({ data, context }) => {
    assertTrainer(context.user.roles);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);

    const firstName = data.firstName.trim().slice(0, 100);
    const lastName = data.lastName.trim().slice(0, 100);
    const picked = trainerSportsFromSlugs(data.sportSlugs);
    if (picked.slugs.length > MAX_TRAINER_SPORTS) {
      throw new AuthError("Можно выбрать не больше четырёх видов спорта.", "VALIDATION");
    }
    if (picked.sports.length !== picked.slugs.length) {
      throw new AuthError("Выберите вид спорта из списка категорий.", "VALIDATION");
    }
    const sports = picked.sports;
    const city = await assertBelarusCity(data.city);
    const [account] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    const phone = formatBelarusPhone(account?.phone || existing?.phone || "");
    let avatarPath = existing?.avatarPath ?? "";

    if (data.image) {
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(data.image);
      if (!match) throw new AuthError("Фото карточки должно быть изображением.", "VALIDATION");
      const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
      if (buffer.length > 1_500_000) throw new AuthError("Фото больше 1,5 МБ.", "VALIDATION");
      const relative = `/trainers/self/${context.user.id}.jpg`;
      await writeImageSet(buffer, path.join(process.cwd(), "public", relative));
      avatarPath = `${relative}?v=${Date.now()}`;
    }

    const places = await resolveTrainingPlaces(data.places, existing ? placesFromProfile(existing) : []);
    const mirror = mirrorTrainingPlace(places);
    const storedAvatar = avatarPath.split("?")[0];
    const photos = data.image
      ? [storedAvatar, ...(existing?.photos ?? []).filter((item) => item !== storedAvatar)].slice(0, 9)
      : undefined;
    const values = {
      firstName,
      lastName,
      fullName: joinTrainerName(firstName, lastName),
      headline: data.headline,
      bio: sanitizeReviewHtml(data.bio),
      about: (() => {
        const html = sanitizeReviewHtml(data.about);
        return reviewPlainText(html) ? [html] : [];
      })(),
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
      instagramUrl: data.instagram,
      telegram: data.telegram,
      email: data.email,
      instagramHandle: instagramHandle(data.instagram, context.user.id),
      experienceYears: data.experienceYears,
      formats: [...new Set(data.formats)],
      audiences: effectiveAudiences(data.audiences),
      avatarPath: storedAvatar,
      ...(photos ? { photos } : {}),
      updatedAt: new Date(),
    };

    try {
    if (existing) {
      if (existing.instagramHandle && !data.instagram) {
        values.instagramHandle = existing.instagramHandle;
      }
      await db.update(trainerProfiles).set(values).where(eq(trainerProfiles.id, existing.id));
    } else {
      const slugBase = slugify(joinTrainerName(firstName, lastName) || context.user.firstName);
      let slug = slugBase;
      const [clash] = await db.select({ id: trainerProfiles.id }).from(trainerProfiles).where(eq(trainerProfiles.slug, slug)).limit(1);
      if (clash) slug = `${slugBase.slice(0, 14)}-${context.user.id.slice(0, 3)}`.slice(0, 18);
      const claimToken = randomBytes(32).toString("base64url");
      await db.insert(trainerProfiles).values({
        ...values,
        slug,
        sourceUrl: data.instagram || `https://trenio.by/trainers/${slug}`,
        status: "draft",
        claimStatus: "claimed",
        createdSource: "self",
        ownerUserId: context.user.id,
        claimToken,
        claimPath: `/trainers/claim/${claimToken}`,
        claimedAt: new Date(),
      });
    }

    return { ok: true as const, message: "Профиль тренера сохранён.", avatarPath };
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
  });
