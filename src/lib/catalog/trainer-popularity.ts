export type TrainerRatingSnapshot = {
  rating: string;
  reviews: number;
  /** Published reviews rated 4 or 5. Low ratings never increase the review-volume part. */
  positiveReviews: number;
  /** Published reviews rated 4 or 5 during the last 180 days. */
  recentPositiveReviews: number;
  /** 90-day opens used for the response score, after a new card's missing days are filled in. */
  views: number;
  /** Contact visitors plus published reviews in that window, after the same fill. */
  engaged: number;
  /** Opens before that fill. The cabinet shows this count. */
  opens: number;
  /** Contacts and reviews before that fill. */
  engagedRaw: number;
  saves: number;
  /** Like weight. A like older than half a year counts as half. */
  likes: number;
  /** Like rows standing now, for the label. */
  likesShown: number;
  /** Likes from the last 20 days, after a new card's missing days are filled in. */
  likePace: number;
  /** Those likes before the fill. */
  likePaceRaw: number;
  /** True when this card is younger than 60 days and the window was filled from the catalog average. */
  coldStart: boolean;
};

/**
 * Caps a trainer can read. The parts add up to 100.
 * The trainer fills the card (18) and the contacts (5).
 * Quality is the star score (20), positive-review count (23), and recent positive reviews (3).
 * Activity is the response rate (11), saves (4), like weight (7), and likes over 20 days (9).
 * The first reviews, saves, and likes still weigh more than the later ones.
 */
export const POPULARITY_LIMITS = {
  cardFields: 10,
  cardEach: 1.8,
  card: 18,
  contactFields: 4,
  contacts: 5,
  self: 23,
  rating: 20,
  reviews: 23,
  recentReviews: 3,
  views: 11,
  saves: 4,
  likes: 7,
  likePace: 9,
  reviewCap: 20,
  recentReviewCap: 5,
  recentReviewDays: 180,
  /** Pretend opens mixed into the response rate, so a handful of visits cannot fill it. */
  viewPrior: 30,
  /** Adjusted response rate that fills the response part. */
  viewRate: 0.25,
  saveCap: 5,
  likeCap: 10,
  likePaceCap: 12,
  /** Reviews mixed into the star average before it is trusted. */
  ratingPriorCount: 7,
  /** Catalog-neutral stars. A short sample is pulled toward this. */
  ratingPrior: 4,
  /** Smoothed or raw average below this earns nothing for the star part. */
  ratingFloor: 3,
  likeHalfDays: 180,
  responseWindowDays: 90,
  likePaceDays: 20,
  coldStartDays: 60,
} as const;

/** Four contacts share 5 points: 2, then 3, 4, and 5. The first contact is worth the most. */
const CONTACT_POINTS = [0, 2, 3, 4, 5] as const;

export function contactPoints(filled: number) {
  const index = Math.min(CONTACT_POINTS.length - 1, Math.max(0, Math.trunc(filled)));
  return CONTACT_POINTS[index] ?? 0;
}

export type PopularityParts = {
  card: number;
  contacts: number;
  rating: number;
  reviews: number;
  recentReviews: number;
  views: number;
  saves: number;
  likes: number;
  likePace: number;
  total: number;
};

export type PopularityChecklist = {
  card: number;
  contacts: number;
  photo: boolean;
  bio: boolean;
  about: boolean;
  sports: boolean;
  experience: boolean;
  price: boolean;
  format: boolean;
  city: boolean;
  place: boolean;
  certificate: boolean;
  phone: boolean;
  instagram: boolean;
  telegram: boolean;
  email: boolean;
};

export type PopularitySource = {
  photo?: string;
  photos?: readonly string[];
  bio?: string;
  about?: string | readonly string[];
  sports?: readonly unknown[];
  experience?: number;
  price?: number | null;
  formats?: readonly unknown[];
  city?: string;
  places?: readonly { city?: string; address?: string }[];
  address?: string | null;
  certificates?: readonly unknown[];
  phone?: string;
  instagram?: string;
  telegram?: string;
  email?: string;
};

const emptySnapshot: TrainerRatingSnapshot = {
  rating: "0",
  reviews: 0,
  positiveReviews: 0,
  recentPositiveReviews: 0,
  views: 0,
  engaged: 0,
  opens: 0,
  engagedRaw: 0,
  saves: 0,
  likes: 0,
  likesShown: 0,
  likePace: 0,
  likePaceRaw: 0,
  coldStart: false,
};

export function ratingFor(
  slug: string,
  ratings: Record<string, TrainerRatingSnapshot> | undefined,
): TrainerRatingSnapshot {
  return ratings?.[slug] ?? emptySnapshot;
}

export function minskDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Inclusive start of a Minsk calendar window that ends today. `days` is the length, so 90 includes today. */
export function minskWindowStart(days: number, now = new Date()) {
  const [year, month, day] = minskDate(now).split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() - Math.max(0, days - 1));
  return utc.toISOString().slice(0, 10);
}

export function minskMonthStart(now = new Date()) {
  return `${minskDate(now).slice(0, 8)}01`;
}

export function recentReviewStart(now = new Date()) {
  return new Date(now.getTime() - POPULARITY_LIMITS.recentReviewDays * 86_400_000);
}

/** Whole Minsk calendar days from `from` through today. */
export function minskAgeDays(from: Date, now = new Date()) {
  const start = Date.parse(`${minskDate(from)}T00:00:00Z`);
  const today = Date.parse(`${minskDate(now)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(today)) return null;
  return Math.max(0, Math.round((today - start) / 86_400_000));
}

/**
 * A new card may not have lived through the requested window.
 * The missing days count as the catalog average, so a new card is not stuck at zero
 * under trainers who have had the whole window.
 */
export function imputeWindow(
  raw: number,
  catalogMean: number,
  ageDays: number | null,
  windowDays: number = POPULARITY_LIMITS.responseWindowDays,
) {
  const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const mean = Number.isFinite(catalogMean) ? Math.max(0, catalogMean) : 0;
  const window = Number.isFinite(windowDays) ? Math.max(1, windowDays) : POPULARITY_LIMITS.responseWindowDays;
  if (
    ageDays == null
    || !Number.isFinite(ageDays)
    || ageDays >= POPULARITY_LIMITS.coldStartDays
    || ageDays >= window
  ) return value;
  const age = Math.min(window, Math.max(0, ageDays));
  const missing = (window - age) / window;
  if (missing <= 0) return value;
  return value + mean * missing;
}

function ratingValue(rating: string) {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "ru");
}

/** Logarithmic volume: the first events add more than the later ones, and the cap fills the part. */
function logPoints(value: number, cap: number, max: number) {
  const clean = Number.isFinite(value) && value > 0 ? value : 0;
  if (clean <= 0 || !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  const ratio = Math.log(1 + clean) / Math.log(1 + cap);
  return Math.round(max * Math.min(1, ratio));
}

/**
 * Star points from the published average.
 * No reviews, or a raw average below 3.0, score 0.
 * Otherwise the average shrinks toward 4.0 until there are enough reviews:
 * smoothed = (n / (n + 7)) × average + (7 / (n + 7)) × 4.0.
 * 3.0 → 0, 4.0 → half, 5.0 → the full part, and the line between those points is straight.
 * One 5.0 therefore lands near 4.0, not on the ceiling.
 */
export function ratingPoints(average: number, reviews: number) {
  const n = safeCount(reviews);
  if (n <= 0 || !Number.isFinite(average) || average < POPULARITY_LIMITS.ratingFloor) return 0;
  const stars = Math.min(5, average);
  const k = POPULARITY_LIMITS.ratingPriorCount;
  const smoothed = (n / (n + k)) * stars + (k / (n + k)) * POPULARITY_LIMITS.ratingPrior;
  if (smoothed < POPULARITY_LIMITS.ratingFloor) return 0;
  const span = Math.min(5, smoothed);
  return Math.round(POPULARITY_LIMITS.rating * (span - POPULARITY_LIMITS.ratingFloor) / (5 - POPULARITY_LIMITS.ratingFloor));
}

/**
 * Response points. Opens alone do not score.
 * adjusted = engaged / (opens + 30). Engaged is contact visitors plus new reviews over 90 days.
 * 0 → 0. A quarter (0.25) fills the part. The line between is straight.
 * One open that becomes a contact stays near the bottom.
 */
export function responsePoints(opens: number, engaged: number) {
  const seen = Number.isFinite(opens) ? Math.max(0, opens) : 0;
  const done = Number.isFinite(engaged) ? Math.max(0, engaged) : 0;
  if (seen <= 0 || done <= 0) return 0;
  const adjusted = done / (seen + POPULARITY_LIMITS.viewPrior);
  const ratio = Math.min(1, adjusted / POPULARITY_LIMITS.viewRate);
  return Math.round(POPULARITY_LIMITS.views * ratio);
}

function visibleText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function aboutFilled(about: PopularitySource["about"]) {
  if (!about) return false;
  if (typeof about === "string") return visibleText(about).length > 0;
  return about.some((part) => visibleText(part).length > 0);
}

function certificateFilled(items: readonly unknown[] | undefined) {
  return (items ?? []).some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (item && typeof item === "object" && "path" in item) {
      return String((item as { path?: unknown }).path ?? "").trim().length > 0;
    }
    return false;
  });
}

/** How many card fields and contacts are filled. Each kind shares its points equally. */
export function popularityChecklist(source: PopularitySource): PopularityChecklist {
  const flags = {
    photo: visibleText(source.photo).length > 0 || (source.photos ?? []).some((item) => visibleText(item).length > 0),
    bio: visibleText(source.bio).length > 0,
    about: aboutFilled(source.about),
    sports: (source.sports ?? []).length > 0,
    experience: (source.experience ?? 0) >= 1,
    price: source.price != null && source.price >= 1,
    format: (source.formats ?? []).length > 0,
    city: visibleText(source.city).length > 0,
    place: (source.places ?? []).some((item) => visibleText(item.city).length > 0 || visibleText(item.address).length > 0)
      || visibleText(source.address).length > 0,
    certificate: certificateFilled(source.certificates),
    phone: visibleText(source.phone).length > 0,
    instagram: visibleText(source.instagram).length > 0,
    telegram: visibleText(source.telegram).length > 0,
    email: visibleText(source.email).length > 0,
  };
  const card = [flags.photo, flags.bio, flags.about, flags.sports, flags.experience, flags.price, flags.format, flags.city, flags.place, flags.certificate]
    .filter(Boolean).length;
  const contacts = [flags.phone, flags.instagram, flags.telegram, flags.email].filter(Boolean).length;
  return { card, contacts, ...flags };
}

export type PopularityInput = {
  rating: string;
  reviews: number;
  positiveReviews?: number;
  recentPositiveReviews?: number;
  views?: number;
  engaged?: number;
  saves?: number;
  likes?: number;
  likePace?: number;
  cardFilled?: number;
  contactsFilled?: number;
};

/**
 * Catalog rank from 0 to 100.
 * A filled card is 20. Contacts are at most 5.
 * Stars use the shrunk average. Review count, saves, like weight, and the 20-day likes use a logarithm.
 * The response part is the share of opens that became a contact or a review, not the open count.
 */
export function popularityParts(item: PopularityInput): PopularityParts {
  const reviewCount = safeCount(item.reviews);
  const positiveReviewCount = Math.min(
    reviewCount,
    safeCount(item.positiveReviews ?? reviewCount),
  );
  const recentPositiveReviewCount = Math.min(
    positiveReviewCount,
    safeCount(item.recentPositiveReviews ?? 0),
  );
  const rawCardFilled = Number.isFinite(item.cardFilled) ? item.cardFilled ?? 0 : 0;
  const rawContactsFilled = Number.isFinite(item.contactsFilled) ? item.contactsFilled ?? 0 : 0;
  const cardFilled = Math.min(POPULARITY_LIMITS.cardFields, Math.max(0, Math.floor(rawCardFilled)));
  const contactsFilled = Math.min(POPULARITY_LIMITS.contactFields, Math.max(0, Math.floor(rawContactsFilled)));
  const card = Math.round(cardFilled * POPULARITY_LIMITS.cardEach);
  const contacts = contactPoints(contactsFilled);
  const rating = ratingPoints(ratingValue(item.rating), reviewCount);
  const reviews = logPoints(positiveReviewCount, POPULARITY_LIMITS.reviewCap, POPULARITY_LIMITS.reviews);
  const recentReviews = logPoints(
    recentPositiveReviewCount,
    POPULARITY_LIMITS.recentReviewCap,
    POPULARITY_LIMITS.recentReviews,
  );
  const views = responsePoints(item.views ?? 0, item.engaged ?? 0);
  const saves = logPoints(item.saves ?? 0, POPULARITY_LIMITS.saveCap, POPULARITY_LIMITS.saves);
  const likes = logPoints(item.likes ?? 0, POPULARITY_LIMITS.likeCap, POPULARITY_LIMITS.likes);
  const likePace = logPoints(item.likePace ?? 0, POPULARITY_LIMITS.likePaceCap, POPULARITY_LIMITS.likePace);
  return {
    card,
    contacts,
    rating,
    reviews,
    recentReviews,
    views,
    saves,
    likes,
    likePace,
    total: card + contacts + rating + reviews + recentReviews + views + saves + likes + likePace,
  };
}

export function popularityScore(item: PopularityInput) {
  return popularityParts(item).total;
}

export function compareByPopularity<T extends PopularityInput & { name: string }>(a: T, b: T) {
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
