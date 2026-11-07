import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  uniqueIndex,
  index,
  primaryKey,
  bigint,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Platform roles — RBAC via user_roles junction table. */
export const userRoleEnum = pgEnum("user_role", [
  "user",
  "trainer",
  "club",
  "admin",
  "superadmin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending_verification",
  "active",
  "suspended",
  "deleted",
]);

/** Post-registration onboarding intent (see docs/ACCOUNT_MODEL.md). */
export const signupIntentEnum = pgEnum("signup_intent", [
  "client_signup",
  "trainer_create",
  "branch_create",
  "brand_create",
  "trainer_claim",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phone: varchar("phone", { length: 32 }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash").notNull(),
    /** Set when the person types a password. Empty for a Google or Yandex account and a magic-link trainer until then. */
    passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
    /** True only for a trainer created from the short Instagram link, until they choose a password. */
    needsPassword: boolean("needs_password").notNull().default(false),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),
    avatarPath: varchar("avatar_path", { length: 300 }).notNull().default(""),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    lastSignupIntent: signupIntentEnum("last_signup_intent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Set while a self-deleted account can still be restored. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }),
    telegramUsername: varchar("telegram_username", { length: 64 }),
    /** Set when this chat has already written to the login bot, or confirmed Telegram inside the Mini App. */
    telegramBotSeenAt: timestamp("telegram_bot_seen_at", { withTimezone: true }),
    /** Stable Google account id. Set when the person signs in with Google. */
    googleSub: varchar("google_sub", { length: 255 }),
    /** Stable Yandex ID. Set when the person signs in with Yandex. */
    yandexSub: varchar("yandex_sub", { length: 255 }),
    /** AES-GCM blob. Empty until a staff account starts enrollment. */
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /** JSON array of SHA-256 hashes. A used code is removed. */
    totpRecoveryHashes: text("totp_recovery_hashes"),
    /** Letter when someone writes in Сообщения. */
    mailMessages: boolean("mail_messages").notNull().default(true),
    /** Letter when the person's review is published or rejected. */
    mailReviews: boolean("mail_reviews").notNull().default(true),
    /** Service notices that are not a code, a password reset, a message, or a review. */
    mailSite: boolean("mail_site").notNull().default(true),
    /** News and picks. Off until the person turns it on. */
    mailMarketing: boolean("mail_marketing").notNull().default(false),
    /** System notice on a phone when someone writes in Сообщения. On until the person turns it off. */
    pushMessages: boolean("push_messages").notNull().default(true),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_phone_unique").on(table.phone),
    uniqueIndex("users_telegram_user_id_unique").on(table.telegramUserId),
    uniqueIndex("users_google_sub_unique").on(table.googleSub),
    uniqueIndex("users_yandex_sub_unique").on(table.yandexSub),
    index("users_status_idx").on(table.status),
    index("users_deleted_at_idx").on(table.deletedAt),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedById: uuid("granted_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("user_roles_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    pendingEmail: varchar("pending_email", { length: 320 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_verification_tokens_user_id_idx").on(table.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  sessions: many(sessions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type SignupIntent = (typeof signupIntentEnum.enumValues)[number];
