import { integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";
import { users } from "./users";

/** Durable auth counters. One row per key, updated in place. */
export const authRateBuckets = pgTable("auth_rate_buckets", {
  bucketKey: varchar("bucket_key", { length: 420 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  hitCount: integer("hit_count").notNull(),
});

/** Telegram widget, Mini App, and contact proofs already accepted. */
export const authReplayKeys = pgTable("auth_replay_keys", {
  keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Short-lived code sent to the contact that is already on the account. */
export const authStepUpCodes = pgTable("auth_step_up_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 16 }).notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One-time permit to change a contact, after a password or a code. */
export const authStepUpGrants = pgTable("auth_step_up_grants", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Staff password/SMS/Telegram login waiting for the authenticator code. */
export const authLoginTickets = pgTable("auth_login_tickets", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Trainer cabinet link mailed before an account exists.
 * The user row is created when the letter is confirmed with POST.
 */
export const authDoorClaims = pgTable("auth_door_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => trainerProfiles.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
