import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/** Editable letters and the Instagram paste. Install with `npm run site:install`, not `db:push`. */
export const siteTexts = pgTable("site_texts", {
  key: text("key").primaryKey(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});
