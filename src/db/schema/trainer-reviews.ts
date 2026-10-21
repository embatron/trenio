import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

/** pending — на модерации, published — на странице тренера, rejected — отменено. */
export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "rejected"]);

export type TrainerReviewMessage = {
  role: "trainer" | "author";
  body: string;
  at: string;
};

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
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    /** Trainer and review author take turns. The original review is the author's first message. */
    messages: jsonb("messages").$type<TrainerReviewMessage[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trainer_reviews_slug_user_unique").on(table.trainerSlug, table.userId),
    index("trainer_reviews_slug_idx").on(table.trainerSlug, table.createdAt),
  ],
);
