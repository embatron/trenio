import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";
import { trainerProfiles } from "./trainer-profiles";

/** Staff notes on a trainer. Each save is a new row, so the history stays. */
export const trainerStaffNotes = pgTable(
  "trainer_staff_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trainer_staff_notes_profile_created_idx").on(table.profileId, table.createdAt),
  ],
);
