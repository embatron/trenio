import { z } from "zod";

import { reviewPlainText } from "@/lib/catalog/review-html";

export const MESSAGE_PAGE_SIZE = 50;
export const CONVERSATION_PAGE_SIZE = 50;
export const MESSAGE_MAX_LENGTH = 4000;
export const FIRST_MESSAGE_MAX_LENGTH = 1000;
/** Distinct trainer profiles one user may message in a Europe/Minsk calendar day. */
export const DAILY_TRAINER_MESSAGE_LIMIT = 10;
export const DAILY_TRAINER_LIMIT_MESSAGE =
  "Сегодня можно написать не больше 10 разных тренеров. Одиннадцатому написать нельзя — ограничение сбросится завтра.";
/** Stored HTML, including tags. The visible limit is the plain-text length. */
export const MESSAGE_HTML_MAX_LENGTH = 12000;
export const PREVIEW_LENGTH = 120;

export const REPORT_REASONS = [
  { id: "spam", label: "Спам" },
  { id: "abuse", label: "Оскорбление" },
  { id: "contact", label: "Нежелательный контакт" },
  { id: "other", label: "Другое" },
] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1, "Укажите профиль.")
  .max(30, "Некорректный адрес профиля.");

export const conversationCursorSchema = z.object({
  at: z.string().min(1),
  id: z.string().uuid(),
});

export const messageCursorSchema = z.object({
  createdAt: z.string().min(1),
  id: z.number().int().positive(),
});

export const listConversationsSchema = z.object({
  view: z.enum(["own", "inbox"], { message: "Неизвестная лента." }),
  cursor: conversationCursorSchema.optional(),
});

export const listMessagesSchema = z.object({
  conversationId: z.string().uuid("Переписка не найдена."),
  cursor: messageCursorSchema.optional(),
});

export const ensureConversationSchema = z.object({
  trainerProfileSlug: slugSchema,
});

export const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    trainerProfileSlug: slugSchema.optional(),
    body: z
      .string()
      .trim()
      .min(1, "Введите сообщение.")
      .max(MESSAGE_HTML_MAX_LENGTH, "Сообщение слишком длинное."),
    clientId: z.string().uuid("Некорректный идентификатор сообщения."),
  })
  .refine((value) => Boolean(value.conversationId || value.trainerProfileSlug), {
    message: "Не указана переписка.",
  });

export const markConversationReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastMessageId: z.number().int().positive(),
});

export const conversationIdSchema = z.object({
  conversationId: z.string().uuid(),
});

export const reportMessageSchema = z.object({
  messageId: z.number().int().positive(),
  reason: z.string().trim().min(1, "Укажите причину.").max(500, "Причина слишком длинная."),
});

export const dismissReportSchema = z.object({
  reportId: z.string().uuid(),
});

export const listReportsSchema = z.object({
  status: z.enum(["new", "reviewed", "dismissed"]).optional(),
});

export type ConversationCursor = z.infer<typeof conversationCursorSchema>;
export type MessageCursor = z.infer<typeof messageCursorSchema>;

export type CounterpartDto = {
  name: string;
  firstName: string;
  lastName: string;
  avatarPath: string;
  slug: string | null;
  kind: "user" | "trainer";
};

export type ConversationListItem = {
  id: string;
  status: "open" | "closed";
  activityAt: string;
  preview: string;
  unread: number;
  counterpart: CounterpartDto;
  trainerSlug: string;
};

export type ConversationListResult = {
  items: ConversationListItem[];
  nextCursor: ConversationCursor | null;
};

export type MessageDto = {
  id: number;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: string;
  deleted: boolean;
  mine: boolean;
  /** Set on the sender's own messages. Null for everyone else's. */
  receipt: "delivered" | "read" | null;
};

export type ThreadResult = {
  conversationId: string;
  status: "open" | "closed";
  counterpart: CounterpartDto;
  trainerName: string;
  trainerSlug: string;
  canWrite: boolean;
  canClose: boolean;
  canReopen: boolean;
  canBlock: boolean;
  canHide: boolean;
  canReport: boolean;
  composeLimit: number;
  messages: MessageDto[];
  nextCursor: MessageCursor | null;
};

export type MessagingSummary = {
  total: number;
  own: number;
  inbox: number;
  ownedSlugs: string[];
};

export const EMPTY_MESSAGING: MessagingSummary = {
  total: 0,
  own: 0,
  inbox: 0,
  ownedSlugs: [],
};

export type ReportRow = {
  id: string;
  status: "new" | "reviewed" | "dismissed";
  reason: string;
  createdAt: string;
  messageId: number;
  preview: string;
  conversationId: string;
  conversationStatus: "open" | "closed";
  reporterId: string;
  reporterName: string;
  trainerName: string;
  trainerSlug: string;
};

export function messagePreview(body: string, max = PREVIEW_LENGTH) {
  const text = reviewPlainText(body).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
