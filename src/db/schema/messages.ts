import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { trainerProfiles } from "./trainer-profiles";
import { users } from "./users";

export const conversationStatusEnum = pgEnum("conversation_status", ["open", "closed"]);

export const messageReportStatusEnum = pgEnum("message_report_status", ["new", "reviewed", "dismissed"]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trainerProfileId: uuid("trainer_profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    status: conversationStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    /** Unused. A participant cannot hide or delete a thread. Kept so existing rows stay valid. */
    userHiddenAt: timestamp("user_hidden_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("conversations_open_pair_unique")
      .on(table.userId, table.trainerProfileId)
      .where(sql`${table.status} = 'open'`),
    index("conversations_user_activity_idx").on(table.userId, table.lastMessageAt.desc()),
    index("conversations_trainer_activity_idx").on(table.trainerProfileId, table.lastMessageAt.desc()),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    clientId: uuid("client_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("messages_conversation_client_unique").on(table.conversationId, table.clientId),
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt.desc()),
    check("messages_body_len", sql`char_length(btrim(${table.body})) between 1 and 12000`),
  ],
);

export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: bigint("last_read_message_id", { mode: "number" }).notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.userId] })],
);

export const messageReports = pgTable(
  "message_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: messageReportStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_reports_message_reporter_unique").on(table.messageId, table.reporterId),
    index("message_reports_status_created_idx").on(table.status, table.createdAt.desc()),
  ],
);

export const blockedPairs = pgTable(
  "blocked_pairs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trainerProfileId: uuid("trainer_profile_id")
      .notNull()
      .references(() => trainerProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.trainerProfileId] })],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
