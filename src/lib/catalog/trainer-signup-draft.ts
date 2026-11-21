import { z } from "zod";

import type { TrainerSportRecord } from "@/db/schema/trainer-profiles";
import { AuthError } from "@/lib/auth/errors";
import { storedBelarusPhone } from "@/lib/auth/phone";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { CERTIFICATE_CAPTION_MAX, MAX_TRAINER_CERTIFICATES } from "@/lib/catalog/certificate-file";
import { reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import type { TrainerAudience, TrainerFormat } from "@/lib/catalog/published-trainers";
import { MAX_TRAINER_SPORTS, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";
import { MAX_TRAINING_PLACES, readTrainingPlaces, type TrainerPlace } from "@/lib/geo/schemas";

/** Card collected on /join/account. The same fields the cabinet already saves. */
export type TrainerSignupCertificate = {
  fileName: string;
  caption: string;
  dataUrl: string;
};

export type TrainerSignupDraft = {
  headline: string;
  bio: string;
  about: string;
  sports: TrainerSportRecord[];
  city: string;
  places: TrainerPlace[];
  priceFrom: number | null;
  experienceYears: number;
  phone: string;
  instagram: string;
  telegram: string;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
  photos: string[];
  certificates: TrainerSignupCertificate[];
};

export const trainerBasicsInputSchema = z.object({
  headline: z.string().trim().max(200).optional().default(""),
  bio: z.string().trim().max(4000),
  about: z.string().trim().max(8000).optional().default(""),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  places: z.array(z.object({
    city: z.string().trim().max(120),
    district: z.string().trim().max(120),
    address: z.string().trim().max(200),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })).max(MAX_TRAINING_PLACES).optional().default([]),
  priceFrom: z.number().int().min(1).max(1_000_000).nullable().optional().default(null),
  experienceYears: z.number().int().min(0).max(80).optional().default(0),
  phone: z.string().trim().max(32).optional().default(""),
  instagram: z.string().trim().max(300).optional().default(""),
  telegram: z.string().trim().max(300).optional().default(""),
  formats: z.array(z.enum(["individual", "group"])).max(2),
  audiences: z.array(z.enum(["adult", "teen", "kid"])).max(3),
  photos: z.array(z.string().max(2_200_000)).max(9).optional().default([]),
  certificates: z.array(z.object({
    fileName: z.string().trim().min(1).max(180),
    caption: z.string().trim().min(1).max(CERTIFICATE_CAPTION_MAX),
    dataUrl: z.string().max(11_000_000),
  })).max(MAX_TRAINER_CERTIFICATES).optional().default([]),
});

export type TrainerBasicsInput = z.infer<typeof trainerBasicsInputSchema>;

const FORMATS = new Set<TrainerFormat>(["individual", "group"]);
const AUDIENCES = new Set<TrainerAudience>(["adult", "teen", "kid"]);

export async function buildTrainerSignupDraft(input: TrainerBasicsInput): Promise<TrainerSignupDraft> {
  const bio = sanitizeReviewHtml(input.bio);
  if (!reviewPlainText(bio)) {
    throw new AuthError("Напишите, как вас представить.", "VALIDATION");
  }
  const sports = trainerSportsFromSlugs(input.sportSlugs).sports;
  if (sports.length < 1) {
    throw new AuthError("Выберите хотя бы один вид спорта.", "VALIDATION");
  }
  if (sports.length > MAX_TRAINER_SPORTS) {
    throw new AuthError("Можно выбрать не больше пяти видов спорта.", "VALIDATION");
  }
  if (!input.city.trim()) {
    throw new AuthError("Выберите город из списка населённых пунктов Беларуси.", "VALIDATION");
  }
  const city = await assertBelarusCity(input.city);
  const formats = [...new Set(input.formats)];
  if (formats.length < 1) {
    throw new AuthError("Выберите формат тренировок.", "VALIDATION");
  }
  const audiences = [...new Set(input.audiences)];
  if (audiences.length < 1) {
    throw new AuthError("Выберите, с кем вы работаете.", "VALIDATION");
  }
  const phoneText = input.phone.trim();
  const phone = storedBelarusPhone(phoneText) ?? "";
  if (phoneText && phoneText !== "+375" && !phone) {
    throw new AuthError("Введите мобильный номер Беларуси или оставьте поле пустым.", "VALIDATION");
  }
  const about = sanitizeReviewHtml(input.about);
  if (input.photos.length < 1) {
    throw new AuthError("Загрузите хотя бы одно фото.", "VALIDATION");
  }
  const photos = input.photos.filter((item) => item.startsWith("data:image/jpeg;base64,"));
  if (photos.length !== input.photos.length) {
    throw new AuthError("Фото должно быть изображением JPEG, PNG или WebP.", "VALIDATION");
  }
  return {
    headline: input.headline.trim(),
    bio,
    about: reviewPlainText(about) ? about : "",
    sports,
    city,
    places: readTrainingPlaces(input.places.map((place) => ({ ...place, geocodeStatus: null }))),
    priceFrom: input.priceFrom,
    experienceYears: input.experienceYears,
    phone,
    instagram: input.instagram.trim(),
    telegram: input.telegram.trim(),
    formats,
    audiences,
    photos,
    certificates: input.certificates.map((item) => ({
      fileName: item.fileName.trim(),
      caption: item.caption.trim(),
      dataUrl: item.dataUrl,
    })),
  };
}

export function parseTrainerSignupDraft(raw: string | null | undefined): TrainerSignupDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TrainerSignupDraft>;
    if (!value || typeof value.bio !== "string" || !reviewPlainText(value.bio)) return null;
    if (!Array.isArray(value.sports) || value.sports.length < 1 || value.sports.length > MAX_TRAINER_SPORTS) return null;
    if (!value.sports.every((sport) =>
      Boolean(sport)
      && typeof sport.slug === "string"
      && typeof sport.parentSlug === "string"
      && typeof sport.label === "string",
    )) return null;
    if (typeof value.city !== "string" || !value.city.trim()) return null;
    if (!Array.isArray(value.formats) || value.formats.length < 1 || value.formats.some((item) => !FORMATS.has(item))) return null;
    if (!Array.isArray(value.audiences) || value.audiences.length < 1 || value.audiences.some((item) => !AUDIENCES.has(item))) return null;
    const photos = Array.isArray(value.photos)
      ? value.photos.filter((item) => typeof item === "string" && item.startsWith("data:image/jpeg;base64,")).slice(0, 9)
      : [];
    const certificates = Array.isArray(value.certificates)
      ? value.certificates.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as Partial<TrainerSignupCertificate>;
          if (typeof row.fileName !== "string" || typeof row.caption !== "string" || typeof row.dataUrl !== "string") return [];
          if (!row.fileName.trim() || !row.caption.trim() || !row.dataUrl.startsWith("data:")) return [];
          return [{
            fileName: row.fileName.trim().slice(0, 180),
            caption: row.caption.trim().slice(0, CERTIFICATE_CAPTION_MAX),
            dataUrl: row.dataUrl,
          }];
        }).slice(0, MAX_TRAINER_CERTIFICATES)
      : [];
    return {
      headline: typeof value.headline === "string" ? value.headline.trim().slice(0, 200) : "",
      bio: value.bio,
      about: typeof value.about === "string" && reviewPlainText(value.about) ? value.about : "",
      sports: value.sports.map((sport) => ({
        slug: sport.slug,
        parentSlug: sport.parentSlug,
        label: sport.label,
      })),
      city: value.city.trim(),
      places: readTrainingPlaces(value.places),
      priceFrom: typeof value.priceFrom === "number" && Number.isInteger(value.priceFrom) && value.priceFrom >= 1
        ? Math.min(value.priceFrom, 1_000_000)
        : null,
      experienceYears: typeof value.experienceYears === "number" && Number.isInteger(value.experienceYears) && value.experienceYears >= 1
        ? Math.min(value.experienceYears, 80)
        : 0,
      phone: typeof value.phone === "string" ? storedBelarusPhone(value.phone) ?? "" : "",
      instagram: typeof value.instagram === "string" ? value.instagram.trim().slice(0, 300) : "",
      telegram: typeof value.telegram === "string" ? value.telegram.trim().slice(0, 300) : "",
      formats: [...new Set(value.formats)],
      audiences: [...new Set(value.audiences)],
      photos,
      certificates,
    };
  } catch {
    return null;
  }
}
