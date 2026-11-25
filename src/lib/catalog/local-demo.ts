import type { PublicTrainerReview, TrainerReviewSummary } from "@/lib/catalog/trainer-reviews";

const LINES = [
  "Занятие прошло спокойно, объясняет понятно.",
  "Хорошая нагрузка, без спешки.",
  "Приду ещё, формат удобный.",
  "Внимательный тренер, темп подобрал сразу.",
  "После месяца уже чувствуется разница.",
  "Зал удобный, время подошло.",
];

const AUTHORS = ["Анна", "Игорь", "Марина", "Павел", "Ольга", "Сергей"];
const MONTHS = ["январь 2026", "февраль 2026", "март 2026", "апрель 2026", "май 2026", "июнь 2026"];

/** Local display only. Production builds drop it. Not stored and not synced. */
export function localDemoEnabled() {
  return import.meta.env.DEV;
}

function mix(slug: string) {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Every other slug, so the same trainer keeps the same sample on every page. */
export function localDemoOn(slug: string) {
  if (!localDemoEnabled()) return false;
  return mix(slug) % 2 === 1;
}

export function localDemoSummary(slug: string): { rating: string; reviews: number; summary: TrainerReviewSummary; reviewsList: PublicTrainerReview[] } | null {
  if (!localDemoOn(slug)) return null;
  const hash = mix(slug);
  const count = 2 + (hash % 5);
  const scores = Array.from({ length: count }, (_, index) => 3 + ((hash + index * 17) % 3));
  const average = scores.reduce((sum, score) => sum + score, 0) / count;
  const rating = average.toFixed(1);
  return {
    rating,
    reviews: count,
    summary: { value: rating, ratingCount: count, reviewCount: count },
    reviewsList: scores.map((score, index) => ({
      id: `local-demo-${slug}-${index}`,
      author: AUTHORS[(hash + index) % AUTHORS.length] ?? "Гость",
      authorSlug: null,
      avatarPath: "",
      date: MONTHS[(hash + index) % MONTHS.length] ?? "2026",
      rating: score,
      text: LINES[(hash + index) % LINES.length] ?? LINES[0],
      messages: [],
      isMine: false,
    })),
  };
}
