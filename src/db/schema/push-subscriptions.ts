import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/** One browser or installed app that asked for message pushes. The endpoint is the push service URL. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** web, ios, or android. Existing rows are web. Native tokens live in user_devices. */
    platform: text("platform").notNull().default("web"),
    /** vapid, apns, or fcm. Existing rows are vapid. */
    tokenType: text("token_type").notNull().default("vapid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
    index("push_subscriptions_user_platform_idx").on(table.userId, table.platform),
  ],
);
