import { bigint, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Permanent trainer journal. No expiry and no foreign key: deleting an account
 * must not erase when the card was added, when it appeared, or what happened
 * to the account. Install with `npm run logs:install`. Do not use `db:push`.
 */
export const trainerJournal = pgTable(
  "trainer_journal",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    profileId: uuid("profile_id"),
    actorUserId: uuid("actor_user_id"),
    subject: varchar("subject", { length: 320 }),
    target: varchar("target", { length: 80 }),
    domain: varchar("domain", { length: 16 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    outcome: varchar("outcome", { length: 16 }),
    level: varchar("level", { length: 8 }).notNull(),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("trainer_journal_created_idx").on(table.createdAt.desc()),
    index("trainer_journal_actor_created_idx").on(table.actorUserId, table.createdAt.desc()),
    index("trainer_journal_target_created_idx").on(table.target, table.createdAt.desc()),
    index("trainer_journal_profile_created_idx").on(table.profileId, table.createdAt.desc()),
    index("trainer_journal_subject_created_idx").on(table.subject, table.createdAt.desc()),
    index("trainer_journal_action_created_idx").on(table.action, table.createdAt.desc()),
  ],
);
