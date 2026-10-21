import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const authOtpPurposeEnum = pgEnum("auth_otp_purpose", [
  "login",
  "verify_phone",
  "register",
  "reset_password",
]);

export const authOtpChallenges = pgTable(
  "auth_otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 16 }).notNull(),
    purpose: authOtpPurposeEnum("purpose").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_otp_phone_purpose_idx").on(table.phone, table.purpose, table.createdAt),
  ],
);

export type AuthOtpPurpose = (typeof authOtpPurposeEnum.enumValues)[number];
