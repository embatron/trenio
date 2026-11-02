export type TrainerRatingSnapshot = {
  rating: string;
  reviews: number;
  /** Published-profile opens in the current Europe/Minsk month. The owner is not included. */
  views: number;
  /** People who saved this trainer card. */
  saves: number;
};

/**
 * Caps a trainer can read. The parts add up to 100.
 * The trainer fills the card and the contacts, at most 30.
 * Users bring the other 70 through ratings, reviews, visits, and saves.
 * The first of those events still weigh more.
 */
export const POPULARITY_LIMITS = {
  cardFields: 10,
  cardEach: 2,
  card: 20,
  contactFields: 4,
  contacts: 10,
  self: 30,
  rating: 25,
  reviews: 15,
  views: 20,
  saves: 10,
  reviewCap: 20,
  viewCap: 15,
  saveCap: 5,
} as const;

/** Four contacts share 10 points. The steps stay whole numbers: 3, then 5, 8, and 10. */
const CONTACT_POINTS = [0, 3, 5, 8, 10] as const;

export function contactPoints(filled: number) {
  const index = Math.min(CONTACT_POINTS.length - 1, Math.max(0, Math.trunc(filled)));
  return CONTACT_POINTS[index] ?? 0;
}

export type PopularityParts = {
  card: number;
  contacts: number;
  rating: number;
  reviews: number;
  views: number;
  saves: number;
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

/**
 * Catalog rank from 0 to 100.
 * A filled card and added contacts are at most 30 points.
 * Ratings, reviews, monthly visits, and saves bring the other 70, with diminishing returns.
 */
export function popularityParts(item: {
  rating: string;
  reviews: number;
  views?: number;
  saves?: number;
  cardFilled?: number;
  contactsFilled?: number;
}): PopularityParts {
  const cardFilled = Math.min(POPULARITY_LIMITS.cardFields, Math.max(0, item.cardFilled ?? 0));
  const contactsFilled = Math.min(POPULARITY_LIMITS.contactFields, Math.max(0, item.contactsFilled ?? 0));
  const card = cardFilled * POPULARITY_LIMITS.cardEach;
  const contacts = contactPoints(contactsFilled);
  const rating = item.reviews > 0
    ? Math.round(POPULARITY_LIMITS.rating * Math.min(ratingValue(item.rating), 5) / 5)
    : 0;
  const reviews = logPoints(item.reviews, POPULARITY_LIMITS.reviewCap, POPULARITY_LIMITS.reviews);
  const views = logPoints(item.views ?? 0, POPULARITY_LIMITS.viewCap, POPULARITY_LIMITS.views);
  const saves = logPoints(item.saves ?? 0, POPULARITY_LIMITS.saveCap, POPULARITY_LIMITS.saves);
  return { card, contacts, rating, reviews, views, saves, total: card + contacts + rating + reviews + views + saves };
}

export function popularityScore(item: {
  rating: string;
  reviews: number;
  views?: number;
  saves?: number;
  cardFilled?: number;
  contactsFilled?: number;
}) {
  return popularityParts(item).total;
}

export function compareByPopularity<T extends {
  name: string;
  rating: string;
  reviews: number;
  views: number;
  saves: number;
  cardFilled?: number;
  contactsFilled?: number;
}>(a: T, b: T) {
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
