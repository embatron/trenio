import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { cabinetInstagram } from "@/lib/catalog/trainer-contact-cross";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { effectiveAudiences, type PublishedTrainer } from "@/lib/catalog/published-trainers";
import { MAX_TRAINER_SPORTS } from "@/lib/catalog/sport-taxonomy";
import { popularityChecklist } from "@/lib/catalog/trainer-popularity";
import { logCaught } from "@/lib/log/logger";

type SportSource = { slug?: string; parentSlug?: string; label?: string };

export type CatalogTrainerSource = {
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarPath: string;
  photos: string[];
  bio: string;
  about: string[] | null;
  sports: SportSource[] | null;
  primarySport: SportSource | null;
  audiences: Array<"adult" | "teen" | "kid"> | null;
  formats: Array<"individual" | "group"> | null;
  city: string;
  citySlug: string;
  district: string;
  createdSource: string;
  address: string | null;
  trainingPlaces: Array<{ city?: string; address?: string; district?: string }> | null;
  certificates: Array<string | { path?: string }> | null;
  priceFrom: number | null;
  experienceYears: number;
  phone: string;
  email: string;
  emailVerifiedAt: Date | null;
  instagramUrl: string;
  instagramHandle: string;
  telegram: string;
  telegramVerifiedAt: Date | null;
  ownerUserId: string | null;
};

export type CatalogTrainerAccount = {
  email: string | null;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
};

function sportOf(sport: SportSource) {
  const slug = sport.slug?.trim() ?? "";
  if (!slug) return null;
  return {
    slug,
    parentSlug: sport.parentSlug?.trim() || slug,
    label: sport.label?.trim() || slug,
  };
}

/** An imported card with no street and no settlement is shown in Minsk. */
function cityLabel(row: CatalogTrainerSource): string {
  const stored = row.city.trim();
  if (stored) return stored;
  if (row.createdSource !== "import") return "";
  if ((row.address ?? "").trim()) return "";
  const placed = (row.trainingPlaces ?? []).some((place) =>
    (place.city ?? "").trim() || (place.address ?? "").trim() || (place.district ?? "").trim(),
  );
  return placed ? "" : "Минск";
}

/** Public catalog card. Phone, Telegram, and email follow the same gates as the profile page. */
export function catalogTrainerFromSources(
  row: CatalogTrainerSource,
  account: CatalogTrainerAccount,
): PublishedTrainer {
  const sports = (row.sports ?? []).flatMap((sport) => {
    const next = sportOf(sport);
    return next ? [next] : [];
  }).slice(0, MAX_TRAINER_SPORTS);
  const primary = row.primarySport ? sportOf(row.primarySport) : null;
  const primarySport = primary ?? sports[0] ?? { slug: "", parentSlug: "", label: "" };
  const label = cityLabel(row);
  const phone = account.phoneVerifiedAt
    ? formatBelarusPhone(row.phone || account.phone || "") || row.phone || ""
    : "";
  const email = row.ownerUserId
    ? account.emailVerifiedAt ? account.email ?? "" : ""
    : row.emailVerifiedAt ? row.email : "";
  return {
    slug: row.slug,
    name: joinTrainerName(row.firstName, row.lastName) || row.fullName || row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    photo: (row.photos?.[0] || row.avatarPath || "").split("?")[0],
    city: { slug: row.citySlug || cityCatalogSlug(label) || "", label },
    sports: sports.length ? sports : primarySport.slug ? [primarySport] : [],
    primarySport,
    bio: row.bio,
    audiences: effectiveAudiences(row.audiences ?? []),
    formats: row.formats ?? [],
    phone,
    instagram: cabinetInstagram(row),
    telegram: row.telegramVerifiedAt ? row.telegram : "",
    email,
    experience: row.experienceYears,
    priceFrom: row.priceFrom ?? 0,
    district: row.district,
    ...catalogRank(row, account, label),
  };
}

/** The same 0–100 parts the cabinet uses. Hidden contacts still count once they are saved. */
function catalogRank(row: CatalogTrainerSource, account: CatalogTrainerAccount, city: string) {
  const fill = popularityChecklist({
    photo: row.avatarPath,
    photos: row.photos,
    bio: row.bio,
    about: row.about ?? [],
    sports: row.sports ?? [],
    experience: row.experienceYears,
    price: row.priceFrom,
    formats: row.formats ?? [],
    city,
    places: row.trainingPlaces ?? [],
    address: row.address,
    certificates: row.certificates ?? [],
    phone: row.phone,
    instagram: cabinetInstagram(row),
    telegram: row.telegram,
    email: row.ownerUserId ? account.email ?? "" : row.email,
  });
  return { cardFilled: fill.card, contactsFilled: fill.contacts };
}

/** Published profiles for the homepage, a city page, and a sport section. */
export const listCatalogTrainersFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await getDb()
      .select({
        slug: trainerProfiles.slug,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
        bio: trainerProfiles.bio,
        about: trainerProfiles.about,
        sports: trainerProfiles.sports,
        primarySport: trainerProfiles.primarySport,
        audiences: trainerProfiles.audiences,
        formats: trainerProfiles.formats,
        city: trainerProfiles.city,
        citySlug: trainerProfiles.citySlug,
        district: trainerProfiles.district,
        createdSource: trainerProfiles.createdSource,
        address: trainerProfiles.address,
        trainingPlaces: trainerProfiles.trainingPlaces,
        certificates: trainerProfiles.certificates,
        priceFrom: trainerProfiles.priceFrom,
        experienceYears: trainerProfiles.experienceYears,
        phone: trainerProfiles.phone,
        email: trainerProfiles.email,
        emailVerifiedAt: trainerProfiles.emailVerifiedAt,
        instagramUrl: trainerProfiles.instagramUrl,
        instagramHandle: trainerProfiles.instagramHandle,
        telegram: trainerProfiles.telegram,
        telegramVerifiedAt: trainerProfiles.telegramVerifiedAt,
        ownerUserId: trainerProfiles.ownerUserId,
        accountEmail: users.email,
        accountEmailVerifiedAt: users.emailVerifiedAt,
        accountPhone: users.phone,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId))
      .where(eq(trainerProfiles.status, "published"));
    return rows.map((row) => catalogTrainerFromSources(row, {
      email: row.accountEmail,
      emailVerifiedAt: row.accountEmailVerifiedAt,
      phone: row.accountPhone,
      phoneVerifiedAt: row.phoneVerifiedAt,
    }));
  } catch (error) {
    logCaught("catalog", "catalog.list", error);
    throw error;
  }
});
