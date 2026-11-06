import { createHash } from "node:crypto";

export const TRAINER_STATUSES = ["draft", "published", "hidden", "archived"] as const;
export type TrainerStatus = (typeof TRAINER_STATUSES)[number];

export type TrainerSyncHead = {
  handle: string;
  status: TrainerStatus;
  updatedAt: string;
  outreachSentAt: string | null;
  inviteSentAt: string | null;
  doorEnteredAt: string | null;
  revision: string;
};

/** Fields that describe the card. Status, marks, and the short link stay out of the hash. */
export type TrainerCardBody = {
  slug: string;
  sourceUrl: string;
  claimStatus: "unclaimed" | "claimed" | "disputed";
  createdSource: "self" | "branch_created" | "admin_created" | "import";
  firstName: string;
  lastName: string;
  fullName: string;
  gender: "" | "male" | "female";
  headline: string;
  bio: string;
  sourceBio: string;
  about: string[];
  pinnedPosts: Array<{ url: string; caption: string }>;
  sports: unknown[];
  primarySport: unknown | null;
  audiences: string[];
  formats: string[];
  city: string;
  citySlug: string;
  district: string;
  trainingPlaces: unknown[];
  address: string | null;
  addressLat: number | null;
  addressLng: number | null;
  geocodeStatus: string | null;
  priceFrom: number | null;
  languages: string[];
  avatarPath: string;
  photos: string[];
  certificates: unknown[];
  phone: string;
  email: string;
  website: string;
  instagramUrl: string;
  telegram: string;
  experienceYears: number;
};

export type SyncMove = {
  pushCard: boolean;
  pullCard: boolean;
  pushStatus: boolean;
  pullStatus: boolean;
  pushMarks: boolean;
  pullMarks: boolean;
};

const OPEN = new Set<TrainerStatus>(["published", "hidden", "archived"]);
const CLAIM = new Set(["unclaimed", "claimed", "disputed"]);
const SOURCE = new Set(["self", "branch_created", "admin_created", "import"]);

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isTrainerStatus(value: unknown): value is TrainerStatus {
  return typeof value === "string" && (TRAINER_STATUSES as readonly string[]).includes(value);
}

export function parseTrainerCard(value: unknown): TrainerCardBody | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const claimStatus = text(row.claimStatus);
  const createdSource = text(row.createdSource);
  const gender = text(row.gender);
  if (!CLAIM.has(claimStatus) || !SOURCE.has(createdSource)) return null;
  if (gender !== "" && gender !== "male" && gender !== "female") return null;
  if (!text(row.firstName).trim() || !text(row.sourceUrl).trim() || !text(row.slug).trim()) return null;
  const pins = Array.isArray(row.pinnedPosts)
    ? row.pinnedPosts.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const pin = item as Record<string, unknown>;
        return [{ url: text(pin.url), caption: text(pin.caption) }];
      })
    : [];
  return {
    slug: text(row.slug).slice(0, 30),
    sourceUrl: text(row.sourceUrl).slice(0, 300),
    claimStatus: claimStatus as TrainerCardBody["claimStatus"],
    createdSource: createdSource as TrainerCardBody["createdSource"],
    firstName: text(row.firstName).slice(0, 100),
    lastName: text(row.lastName).slice(0, 100),
    fullName: text(row.fullName).slice(0, 200),
    gender,
    headline: text(row.headline).slice(0, 200),
    bio: text(row.bio),
    sourceBio: text(row.sourceBio),
    about: textList(row.about),
    pinnedPosts: pins,
    sports: Array.isArray(row.sports) ? row.sports : [],
    primarySport: row.primarySport && typeof row.primarySport === "object" ? row.primarySport : null,
    audiences: textList(row.audiences),
    formats: textList(row.formats),
    city: text(row.city).slice(0, 120),
    citySlug: text(row.citySlug).slice(0, 18),
    district: text(row.district).slice(0, 120),
    trainingPlaces: Array.isArray(row.trainingPlaces) ? row.trainingPlaces : [],
    address: row.address == null ? null : text(row.address),
    addressLat: numberOrNull(row.addressLat),
    addressLng: numberOrNull(row.addressLng),
    geocodeStatus: row.geocodeStatus == null ? null : text(row.geocodeStatus),
    priceFrom: numberOrNull(row.priceFrom),
    languages: textList(row.languages),
    avatarPath: text(row.avatarPath).slice(0, 300),
    photos: textList(row.photos).slice(0, 9),
    certificates: Array.isArray(row.certificates) ? row.certificates.slice(0, 5) : [],
    phone: text(row.phone).slice(0, 32),
    email: text(row.email).slice(0, 320),
    website: text(row.website).slice(0, 300),
    instagramUrl: text(row.instagramUrl).slice(0, 300),
    telegram: text(row.telegram).slice(0, 300),
    experienceYears: Math.max(0, Math.min(80, Math.round(numberOrNull(row.experienceYears) ?? 0))),
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = stable(source[key]);
    return out;
  }
  return value ?? null;
}

export function trainerRevision(body: TrainerCardBody) {
  return createHash("sha256").update(JSON.stringify(stable(body))).digest("hex").slice(0, 16);
}

function time(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newer(left: string, right: string): "left" | "right" | "tie" {
  const a = time(left);
  const b = time(right);
  if (a > b) return "left";
  if (b > a) return "right";
  return "tie";
}

/** A draft never replaces a catalog status. Two catalog statuses follow the newer card, and a tie keeps the side named here. */
export function mergedStatus(
  existing: TrainerStatus,
  incoming: TrainerStatus,
  existingAt: string,
  incomingAt: string,
  tie: "existing" | "incoming",
): TrainerStatus {
  if (existing === incoming) return existing;
  const existingOpen = OPEN.has(existing);
  const incomingOpen = OPEN.has(incoming);
  if (existingOpen && !incomingOpen) return existing;
  if (incomingOpen && !existingOpen) return incoming;
  const which = newer(existingAt, incomingAt);
  if (which === "left") return existing;
  if (which === "right") return incoming;
  return tie === "incoming" ? incoming : existing;
}

export function incomingCardWins(existingAt: string, incomingAt: string, tie: "existing" | "incoming") {
  const which = newer(existingAt, incomingAt);
  if (which === "right") return true;
  if (which === "left") return false;
  return tie === "incoming";
}

function stampMissing(local: string | null, remote: string | null) {
  return Boolean(local) && !remote;
}

/** What this laptop should copy. A missing card moves whole. Text moves only when the hash differs. */
export function syncMove(local: TrainerSyncHead | null, remote: TrainerSyncHead | null): SyncMove {
  const none: SyncMove = {
    pushCard: false,
    pullCard: false,
    pushStatus: false,
    pullStatus: false,
    pushMarks: false,
    pullMarks: false,
  };
  if (!local && !remote) return none;
  if (local && !remote) return { ...none, pushCard: true };
  if (!local && remote) return { ...none, pullCard: true };
  const left = local as TrainerSyncHead;
  const right = remote as TrainerSyncHead;
  const status = mergedStatus(left.status, right.status, left.updatedAt, right.updatedAt, "incoming");
  const card = left.revision !== right.revision && incomingCardWins(left.updatedAt, right.updatedAt, "incoming");
  const localCard = left.revision !== right.revision && !card;
  return {
    pushCard: localCard,
    pullCard: card,
    pushStatus: status === left.status && left.status !== right.status,
    pullStatus: status === right.status && left.status !== right.status,
    pushMarks: stampMissing(left.outreachSentAt, right.outreachSentAt)
      || stampMissing(left.inviteSentAt, right.inviteSentAt)
      || stampMissing(left.doorEnteredAt, right.doorEnteredAt),
    pullMarks: stampMissing(right.outreachSentAt, left.outreachSentAt)
      || stampMissing(right.inviteSentAt, left.inviteSentAt)
      || stampMissing(right.doorEnteredAt, left.doorEnteredAt),
  };
}
