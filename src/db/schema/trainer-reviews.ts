import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

/** pending — на модерации, published — на странице тренера, rejected — отменено. */
export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "rejected"]);

export const trainerReviews = pgTable(
  "trainer_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainerSlug: varchar("trainer_slug", { length: 80 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorName: varchar("author_name", { length: 120 }).notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").notNull().default("published"),
    moderationNote: text("moderation_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trainer_reviews_slug_user_unique").on(table.trainerSlug, table.userId),
    index("trainer_reviews_slug_idx").on(table.trainerSlug, table.createdAt),
  ],
);
