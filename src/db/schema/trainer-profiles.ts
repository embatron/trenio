import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const trainerProfileStatusEnum = pgEnum("trainer_profile_status", [
  "draft",
  "published",
  "hidden",
  "archived",
]);

export const trainerClaimStatusEnum = pgEnum("trainer_claim_status", [
  "unclaimed",
  "claimed",
  "disputed",
]);

export const trainerCreatedSourceEnum = pgEnum("trainer_created_source", [
  "self",
  "branch_created",
  "admin_created",
  "import",
]);

export type TrainerSportRecord = {
  slug: string;
  parentSlug: string;
  label: string;
  evidence?: string;
};

export type TrainerPinnedPost = {
  url: string;
  caption: string;
};

export const trainerProfiles = pgTable(
  "trainer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 30 }).notNull(),
    instagramHandle: varchar("instagram_handle", { length: 30 }).notNull(),
    sourceUrl: varchar("source_url", { length: 300 }).notNull(),
    status: trainerProfileStatusEnum("status").notNull().default("draft"),
    claimStatus: trainerClaimStatusEnum("claim_status").notNull().default("unclaimed"),
    createdSource: trainerCreatedSourceEnum("created_source").notNull().default("import"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: varchar("first_name", { length: 100 }).notNull().default(""),
    lastName: varchar("last_name", { length: 100 }).notNull().default(""),
    fullName: varchar("full_name", { length: 200 }).notNull().default(""),
    /** `male` or `female` from the Instagram import. Empty when the name is ambiguous. Staff-only. */
    gender: varchar("gender", { length: 8 }).notNull().default(""),
    headline: varchar("headline", { length: 200 }).notNull().default(""),
    /** Text shown on the public profile. */
    bio: text("bio").notNull().default(""),
    /** Verbatim Instagram bio from the import. */
    sourceBio: text("source_bio").notNull().default(""),
    about: jsonb("about").$type<string[]>().notNull().default([]),
    pinnedPosts: jsonb("pinned_posts").$type<TrainerPinnedPost[]>().notNull().default([]),
    sports: jsonb("sports").$type<TrainerSportRecord[]>().notNull().default([]),
    primarySport: jsonb("primary_sport").$type<TrainerSportRecord | null>(),
    audiences: jsonb("audiences").$type<Array<"adult" | "teen" | "kid">>().notNull().default([]),
    formats: jsonb("formats").$type<Array<"individual" | "group">>().notNull().default([]),
    city: varchar("city", { length: 120 }).notNull().default(""),
    citySlug: varchar("city_slug", { length: 18 }).notNull().default(""),
    district: varchar("district", { length: 120 }).notNull().default(""),
    priceFrom: integer("price_from"),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    avatarPath: varchar("avatar_path", { length: 300 }).notNull().default(""),
    /** Up to 9 profile photos. The first one is `avatarPath`. */
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    /** Up to five certificates or diplomas. Each item is `{ path, caption }`. Older rows may still store a path string. */
    certificates: jsonb("certificates").$type<Array<{ path: string; caption: string } | string>>().notNull().default([]),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    /** Contact email copied from a public profile. Not confirmed and not a login. */
    email: varchar("email", { length: 320 }).notNull().default(""),
    website: varchar("website", { length: 300 }).notNull().default(""),
    instagramUrl: varchar("instagram_url", { length: 300 }).notNull().default(""),
    telegram: varchar("telegram", { length: 300 }).notNull().default(""),
    experienceYears: integer("experience_years").notNull().default(0),
    /** Secret segment of the invite link. Kept so the same link can be sent later. */
    claimToken: varchar("claim_token", { length: 64 }).notNull(),
    /** Unique path, `/trainers/claim/{claimToken}`. Full URL is `APP_URL` plus this path. */
    claimPath: varchar("claim_path", { length: 96 }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /** Set when the trainer accepts the public offer while claiming the profile. */
    offerAcceptedAt: timestamp("offer_accepted_at", { withTimezone: true }),
    privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
    offerVersion: varchar("offer_version", { length: 32 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trainer_profiles_slug_unique").on(table.slug),
    uniqueIndex("trainer_profiles_instagram_handle_unique").on(table.instagramHandle),
    uniqueIndex("trainer_profiles_claim_token_unique").on(table.claimToken),
    uniqueIndex("trainer_profiles_claim_path_unique").on(table.claimPath),
    index("trainer_profiles_status_idx").on(table.status),
    index("trainer_profiles_claim_status_idx").on(table.claimStatus),
    index("trainer_profiles_city_slug_idx").on(table.citySlug),
    index("trainer_profiles_owner_user_id_idx").on(table.ownerUserId),
  ],
);

export type TrainerProfile = typeof trainerProfiles.$inferSelect;
export type NewTrainerProfile = typeof trainerProfiles.$inferInsert;
