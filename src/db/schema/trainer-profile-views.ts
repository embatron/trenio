import { date, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";

/** One row is one arrival on a published profile. A later open after a quiet half hour is another row. */
export const trainerProfileViews = pgTable(
  "trainer_profile_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 36 }).notNull(),
    day: date("day").notNull(),
    /** When this arrival was stored. */
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** This arrival: direct, search, social, instagram, chat, catalog, or other. */
    source: varchar("source", { length: 16 }),
  },
  (table) => [
    index("trainer_profile_views_profile_day_idx").on(table.profileId, table.day),
    index("trainer_profile_views_visitor_seen_idx").on(table.profileId, table.visitorId, table.seenAt),
  ],
);
