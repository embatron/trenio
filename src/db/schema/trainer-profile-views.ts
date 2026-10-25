import { date, index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";

/** One row is one visitor opening a published profile on one Europe/Minsk day. */
export const trainerProfileViews = pgTable(
  "trainer_profile_views",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 36 }).notNull(),
    day: date("day").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.visitorId, table.day] }),
    index("trainer_profile_views_profile_day_idx").on(table.profileId, table.day),
  ],
);
