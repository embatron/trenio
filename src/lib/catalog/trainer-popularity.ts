export type TrainerRatingSnapshot = {
  rating: string;
  reviews: number;
};

export function ratingFor(
  slug: string,
  ratings: Record<string, TrainerRatingSnapshot> | undefined,
): TrainerRatingSnapshot {
  return ratings?.[slug] ?? { rating: "0", reviews: 0 };
}

function ratingValue(rating: string) {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "ru");
}

/** Reviews weigh more than a higher average: reviews × 10 + average rating. */
export function popularityScore(item: { rating: string; reviews: number }) {
  return item.reviews * 10 + ratingValue(item.rating);
}

export function compareByPopularity<T extends { name: string; rating: string; reviews: number }>(a: T, b: T) {
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
