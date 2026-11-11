import { z } from "zod";

import type { TrainerSportRecord } from "@/db/schema/trainer-profiles";
import { AuthError } from "@/lib/auth/errors";
import { assertBelarusCity } from "@/lib/catalog/belarus-city.server";
import { reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import type { TrainerAudience, TrainerFormat } from "@/lib/catalog/published-trainers";
import { MAX_TRAINER_SPORTS, trainerSportsFromSlugs } from "@/lib/catalog/sport-taxonomy";

/** Basic card collected on /join/account. The same fields the cabinet already saves. */
export type TrainerSignupDraft = {
  bio: string;
  sports: TrainerSportRecord[];
  city: string;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
};

export const trainerBasicsInputSchema = z.object({
  bio: z.string().trim().max(4000),
  sportSlugs: z.array(z.string().trim().min(1).max(40)).max(MAX_TRAINER_SPORTS),
  city: z.string().trim().max(120),
  formats: z.array(z.enum(["individual", "group"])).max(2),
  audiences: z.array(z.enum(["adult", "teen", "kid"])).max(3),
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
    throw new AuthError("Можно выбрать не больше четырёх видов спорта.", "VALIDATION");
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
  return { bio, sports, city, formats, audiences };
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
    return {
      bio: value.bio,
      sports: value.sports.map((sport) => ({
        slug: sport.slug,
        parentSlug: sport.parentSlug,
        label: sport.label,
      })),
      city: value.city.trim(),
      formats: [...new Set(value.formats)],
      audiences: [...new Set(value.audiences)],
    };
  } catch {
    return null;
  }
}
