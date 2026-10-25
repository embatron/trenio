export type TrainerRatingSnapshot = {
  rating: string;
  reviews: number;
  /** Published-profile opens in the current Europe/Minsk month. The owner is not included. */
  views: number;
  /** People who saved this trainer card. */
  saves: number;
};

/** Caps a trainer can read. The four weights add up to 100. */
export const POPULARITY_LIMITS = {
  rating: 50,
  reviews: 25,
  views: 15,
  saves: 10,
  reviewCap: 20,
  viewCap: 30,
  saveCap: 10,
} as const;

export type PopularityParts = {
  rating: number;
  reviews: number;
  views: number;
  saves: number;
  total: number;
};

const emptySnapshot: TrainerRatingSnapshot = { rating: "0", reviews: 0, views: 0, saves: 0 };

export function ratingFor(
  slug: string,
  ratings: Record<string, TrainerRatingSnapshot> | undefined,
): TrainerRatingSnapshot {
  return ratings?.[slug] ?? emptySnapshot;
}

export function minskMonthStart(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `${today.slice(0, 8)}01`;
}

function ratingValue(rating: string) {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "ru");
}

/** Logarithmic volume: the first events add more than the later ones, and the cap fills the part. */
function logPoints(value: number, cap: number, max: number) {
  if (value <= 0 || cap <= 0 || max <= 0) return 0;
  const ratio = Math.log(1 + value) / Math.log(1 + cap);
  return Math.round(max * Math.min(1, ratio));
}

/**
 * Catalog rank from 0 to 100.
 * Rating quality is half. Review volume, monthly views, and saves fill the rest
 * with diminishing returns, the same shape review catalogs use for vote volume.
 */
export function popularityParts(item: {
  rating: string;
  reviews: number;
  views?: number;
  saves?: number;
}): PopularityParts {
  const rating = item.reviews > 0
    ? Math.round(POPULARITY_LIMITS.rating * Math.min(ratingValue(item.rating), 5) / 5)
    : 0;
  const reviews = logPoints(item.reviews, POPULARITY_LIMITS.reviewCap, POPULARITY_LIMITS.reviews);
  const views = logPoints(item.views ?? 0, POPULARITY_LIMITS.viewCap, POPULARITY_LIMITS.views);
  const saves = logPoints(item.saves ?? 0, POPULARITY_LIMITS.saveCap, POPULARITY_LIMITS.saves);
  return { rating, reviews, views, saves, total: rating + reviews + views + saves };
}

export function popularityScore(item: {
  rating: string;
  reviews: number;
  views?: number;
  saves?: number;
}) {
  return popularityParts(item).total;
}

export function compareByPopularity<T extends { name: string; rating: string; reviews: number; views: number; saves: number }>(a: T, b: T) {
  const byScore = popularityScore(b) - popularityScore(a);
  if (byScore !== 0) return byScore;
  return byName(a, b);
}

export function compareByRating<T extends { name: string; rating: string; reviews: number }>(a: T, b: T) {
  const byRating = ratingValue(b.rating) - ratingValue(a.rating);
  if (byRating !== 0) return byRating;
  if (b.reviews !== a.reviews) return b.reviews - a.reviews;
  return byName(a, b);
}

export function compareByReviews<T extends { name: string; rating: string; reviews: number }>(a: T, b: T) {
  if (b.reviews !== a.reviews) return b.reviews - a.reviews;
  return byName(a, b);
}
