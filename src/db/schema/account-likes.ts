import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";
import { users } from "./users";

/** One row is one account liking one published trainer card. A second tap deletes the row. */
export const accountLikes = pgTable(
  "account_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("account_likes_actor_profile_unique").on(table.actorUserId, table.profileId),
    index("account_likes_profile_idx").on(table.profileId),
    index("account_likes_actor_idx").on(table.actorUserId),
  ],
);
