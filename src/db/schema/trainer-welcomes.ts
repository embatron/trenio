import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * One row per `/join/trainer` submission.
 * `link_sent_at` is written when that trainer opens the draft via `/trainers/claim/{token}`.
 * A filled value means the candidate was handled and the link reached them.
 */
export const trainerWelcomes = pgTable("trainer_welcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: varchar("channel", { length: 16 }).notNull(),
  instagram: varchar("instagram", { length: 30 }),
  telegram: varchar("telegram", { length: 32 }),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  linkSentAt: timestamp("link_sent_at", { withTimezone: true }),
});
