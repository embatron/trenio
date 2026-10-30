import { randomBytes } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";

import { formatBelarusPhone } from "@/lib/auth/phone";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { inferTrainerGender, type TrainerGender } from "@/lib/catalog/trainer-gender";
import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";
import { getDb } from "./index";
import { trainerProfiles, type TrainerPinnedPost, type TrainerSportRecord } from "./schema";

export type ImportedTrainerDraft = {
  handle: string;
  slug: string;
  sourceUrl: string;
  status?: "draft" | "published" | "hidden" | "archived";
  claimStatus?: "unclaimed" | "claimed" | "disputed";
  createdSource?: "self" | "branch_created" | "admin_created" | "import";
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: TrainerGender;
  headline: string;
  bio: string;
  sourceBio?: string;
  about?: string[];
  pinned?: TrainerPinnedPost[];
  sports?: TrainerSportRecord[];
  primarySport?: TrainerSportRecord | null;
  audiences?: Array<"adult" | "teen" | "kid">;
  formats?: Array<"individual" | "group">;
  city: string;
  citySlug?: string;
  district?: string;
  priceFrom?: number | null;
  languages?: string[];
  avatarPath?: string;
  photos?: string[];
  certificates?: Array<{ path: string; caption: string }>;
  phone?: string;
  email?: string;
  telegram?: string;
  website?: string;
  instagramUrl?: string;
  experienceYears?: number;
};


export function claimPathFor(token: string) {
  return `/trainers/claim/${token}`;
}

function newClaimToken() {
  return randomBytes(32).toString("base64url");
}

export async function upsertImportedTrainer(draft: ImportedTrainerDraft) {
  const db = getDb();
  const slug = instagramProfileSlug(draft.handle);
  if (!slug) throw new Error("Instagram nick is empty.");
  const [existing] = await db
    .select()
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, slug))
    .limit(1);
  const [taken] = await db
    .select({ id: trainerProfiles.id, handle: trainerProfiles.instagramHandle })
    .from(trainerProfiles)
    .where(existing
      ? and(eq(trainerProfiles.slug, slug), ne(trainerProfiles.id, existing.id))
      : eq(trainerProfiles.slug, slug))
    .limit(1);
  if (taken) throw new Error(`Nick ${slug} is already used by @${taken.handle}.`);

  const claimToken = existing?.claimToken ?? newClaimToken();
  const claimPath = existing?.claimPath ?? claimPathFor(claimToken);
  const values = {
    slug,
    instagramHandle: slug,
    sourceUrl: draft.sourceUrl,
    status: draft.status ?? "draft",
    claimStatus: existing?.claimStatus === "claimed" ? "claimed" : (draft.claimStatus ?? "unclaimed"),
    createdSource: draft.createdSource ?? "import",
    firstName: draft.firstName,
    lastName: draft.lastName,
    fullName: draft.fullName,
    gender: draft.gender === "male" || draft.gender === "female"
      ? draft.gender
      : inferTrainerGender(draft.firstName, `${draft.bio}\n${draft.fullName}`),
    headline: draft.headline,
    bio: draft.bio,
    sourceBio: draft.sourceBio ?? draft.bio,
    about: draft.about ?? [],
    pinnedPosts: draft.pinned ?? [],
    sports: draft.sports ?? [],
    primarySport: draft.primarySport ?? null,
    audiences: draft.audiences?.length ? draft.audiences : ["adult"],
    formats: draft.formats ?? [],
    city: draft.city,
    citySlug: draft.citySlug || cityCatalogSlug(draft.city) || "",
    district: draft.district ?? "",
    priceFrom: draft.priceFrom ?? null,
    languages: draft.languages ?? [],
    avatarPath: draft.avatarPath ?? "",
    photos: draft.photos ?? (existing?.photos?.length ? existing.photos : draft.avatarPath ? [draft.avatarPath] : []),
    certificates: draft.certificates ?? existing?.certificates ?? [],
    phone: formatBelarusPhone(draft.phone ?? ""),
    email: draft.email ?? "",
    website: draft.website ?? "",
    telegram: draft.telegram ?? "",
    instagramUrl: draft.instagramUrl || draft.sourceUrl,
    experienceYears: draft.experienceYears ?? 0,
    claimToken,
    claimPath,
    updatedAt: new Date(),
  } as const;

  if (existing) {
    await db.update(trainerProfiles).set(values).where(eq(trainerProfiles.id, existing.id));
    return { id: existing.id, claimPath, created: false };
  }

  const [created] = await db
    .insert(trainerProfiles)
    .values(values)
    .returning({ id: trainerProfiles.id, claimPath: trainerProfiles.claimPath });
  return { id: created.id, claimPath: created.claimPath, created: true };
}
