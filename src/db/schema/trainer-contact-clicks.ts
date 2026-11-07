import { date, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";

/** One row is one click on a published profile's phone, Instagram, or Telegram. */
export const trainerContactClicks = pgTable(
  "trainer_contact_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    visitorId: varchar("visitor_id", { length: 36 }).notNull(),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trainer_contact_clicks_profile_kind_day_idx").on(table.profileId, table.kind, table.day),
    index("trainer_contact_clicks_lookup_idx").on(table.profileId, table.visitorId, table.kind, table.createdAt),
  ],
);
