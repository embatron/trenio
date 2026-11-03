import { date, index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";

/** One row is one visitor seeing a published card in the catalog on one Europe/Minsk day. */
export const trainerCardImpressions = pgTable(
  "trainer_card_impressions",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 36 }).notNull(),
    day: date("day").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.visitorId, table.day] }),
    index("trainer_card_impressions_profile_day_idx").on(table.profileId, table.day),
  ],
);
