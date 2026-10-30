import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
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
    check("messages_body_len", sql`char_length(btrim(${table.body})) <= 12000`),
  ],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").primaryKey(),
    messageId: bigint("message_id", { mode: "number" }).references(() => messages.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    byteSize: integer("byte_size").notNull(),
    ext: text("ext").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("message_attachments_message_idx").on(table.messageId),
    index("message_attachments_client_idx").on(table.conversationId, table.clientId),
    check("message_attachments_size", sql`${table.byteSize} between 1 and 2097152`),
    check("message_attachments_name_len", sql`char_length(${table.originalName}) between 1 and 180`),
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
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** Set only for an older complaint about one message. A chat complaint leaves this empty. */
    messageId: bigint("message_id", { mode: "number" }).references(() => messages.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Russian label: Спам, Оскорбление, Нежелательный контакт, Другое. */
    reason: text("reason").notNull(),
    /** Plain words from the reporter. Not a chat message. */
    comment: text("comment").notNull(),
    /** `client` opened the chat. `trainer` owns the profile. */
    reporterSide: text("reporter_side").notNull(),
    status: messageReportStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_reports_conversation_reporter_unique").on(table.conversationId, table.reporterId),
    uniqueIndex("message_reports_message_reporter_unique").on(table.messageId, table.reporterId),
    index("message_reports_status_created_idx").on(table.status, table.createdAt.desc()),
    check("message_reports_comment_len", sql`char_length(btrim(${table.comment})) between 1 and 2000`),
    check("message_reports_reporter_side", sql`${table.reporterSide} in ('client', 'trainer')`),
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
