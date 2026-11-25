import { bigint, index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Post-image of a trainer card. At most 12 rows per profile. No foreign key:
 * deleting a card must not require this table, and the actor account can go
 * away without erasing the snapshot. Install with `npm run trainers:revisions`.
 * Do not use `db:push`.
 */
export const trainerRevisions = pgTable(
  "trainer_revisions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    profileId: uuid("profile_id").notNull(),
    slug: varchar("slug", { length: 30 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id"),
    source: varchar("source", { length: 16 }).notNull(),
    kind: varchar("kind", { length: 8 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, string>>().notNull(),
  },
  (table) => [
    index("trainer_revisions_profile_idx").on(table.profileId, table.id.desc()),
  ],
);
