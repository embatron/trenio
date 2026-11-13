import { z } from "zod";

import { reviewPlainText, reviewTextLength } from "@/lib/catalog/review-html";
import { MESSAGE_ATTACHMENT_MAX_COUNT } from "@/lib/messages/attachments";

export { MESSAGE_ATTACHMENT_MAX_COUNT };

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

/** Visible characters in the reporter's comment. */
export const REPORT_COMMENT_MAX_LENGTH = 1000;

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
  view: z.enum(["own", "inbox", "staff"], { message: "Неизвестная лента." }),
  cursor: conversationCursorSchema.optional(),
  query: z.string().trim().max(80, "Слишком длинный запрос.").optional(),
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
    body: z.string().trim().max(MESSAGE_HTML_MAX_LENGTH, "Сообщение слишком длинное.").default(""),
    clientId: z.string().uuid("Некорректный идентификатор сообщения."),
    attachmentIds: z.array(z.string().uuid()).max(MESSAGE_ATTACHMENT_MAX_COUNT, "Можно прикрепить не больше 9 файлов.").default([]),
    replyToId: z.number().int().positive().optional(),
  })
  .refine((value) => Boolean(value.conversationId || value.trainerProfileSlug), {
    message: "Не указана переписка.",
  })
  .refine((value) => value.body.length > 0 || value.attachmentIds.length > 0, {
    message: "Введите сообщение.",
  });

export const uploadMessageFileSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  clientId: z.string().uuid(),
  fileName: z.string().trim().min(1, "Укажите имя файла.").max(180, "Имя файла слишком длинное."),
  dataUrl: z.string().min(1, "Файл не прочитан.").max(7_200_000, "Файл больше 5 МБ."),
});

export const editMessageSchema = z.object({
  messageId: z.number().int().positive(),
  body: z.string().trim().min(1, "Введите сообщение.").max(MESSAGE_HTML_MAX_LENGTH, "Сообщение слишком длинное."),
});

export const reactMessageSchema = z.object({
  messageId: z.number().int().positive(),
});

export const markConversationReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastMessageId: z.number().int().positive(),
});

export const conversationIdSchema = z.object({
  conversationId: z.string().uuid(),
});

export const reportMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    reason: z.enum(["spam", "abuse", "contact", "other"]),
    comment: z.string().trim().min(1, "Напишите комментарий.").max(2000, "Комментарий слишком длинный."),
  })
  .superRefine((value, ctx) => {
    if (reviewTextLength(value.comment) > REPORT_COMMENT_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Комментарий — не длиннее 1000 символов." });
    }
  });

export const dismissReportSchema = z.object({
  reportId: z.string().uuid(),
});

export const listReportsSchema = z.object({
  status: z.enum(["new", "reviewed", "dismissed"]).optional(),
});

export type ConversationCursor = z.infer<typeof conversationCursorSchema>;
export type MessageCursor = z.infer<typeof messageCursorSchema>;

/** Green: on the site. Orange: hidden or seen within ten minutes. Gray: offline. */
export type Presence = "online" | "away" | "offline";

export type CounterpartDto = {
  name: string;
  firstName: string;
  lastName: string;
  avatarPath: string;
  slug: string | null;
  /** Published card. Empty when this person has no public page. */
  href: string | null;
  kind: "user" | "trainer";
  presence: Presence;
};

export type ConversationListItem = {
  id: string;
  status: "open" | "closed";
  activityAt: string;
  preview: string;
  unread: number;
  /** Last message: stored on the server, or already read by the person it was sent to. */
  receipt: "delivered" | "read" | null;
  counterpart: CounterpartDto;
  trainerSlug: string;
  /** The other person in a staff row: trainer when the title is the client, and the reverse. */
  aside?: string;
};

export type ConversationListResult = {
  items: ConversationListItem[];
  nextCursor: ConversationCursor | null;
  /** Full list size. Set for the staff view, which is paged. */
  total?: number;
};

export type MessageQuoteDto = {
  id: number;
  preview: string;
};

export type MessageAttachmentDto = {
  id: string;
  name: string;
  mime: string;
  byteSize: number;
  kind: "image" | "file";
};

export type MessageDto = {
  id: number;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: string;
  editedAt: string | null;
  /** The sender may still change the text. */
  canEdit: boolean;
  replyTo: MessageQuoteDto | null;
  deleted: boolean;
  mine: boolean;
  /** Client side of the thread is turquoise. The profile side is coral. */
  side: "user" | "trainer";
  /** Set on the sender's own messages. Null for everyone else's. */
  receipt: "delivered" | "read" | null;
  /** This account marked the message with a thumb. */
  liked: boolean;
  /** The other person marked this message. The author sees it and cannot press it. */
  peerLiked: boolean;
  attachments: MessageAttachmentDto[];
};

export type ThreadResult = {
  conversationId: string;
  status: "open" | "closed";
  counterpart: CounterpartDto;
  trainerName: string;
  trainerSlug: string;
  /** Published card of the profile this thread is about. */
  trainerHref: string | null;
  canWrite: boolean;
  /** This client account cannot message this trainer profile. Other dialogs stay open. */
  blocked: boolean;
  canClose: boolean;
  canReopen: boolean;
  canBlock: boolean;
  canHide: boolean;
  canReport: boolean;
  /** This account is in the thread, so opening it may move their read cursor. A staff reader does not. */
  canMarkRead: boolean;
  /** A participant may clear the thread for themselves. The other side keeps it. */
  canDelete: boolean;
  /** The other participant cleared their copy, and this side still has a message from before that. */
  deletedByCounterpart: boolean;
  /** This account's dialog list includes the thread. An empty draft belongs only to the person who opened it. */
  listed: boolean;
  composeLimit: number;
  /** Viewer's own read cursor. Null when this account has never marked the thread. */
  viewerReadMessageId: number | null;
  messages: MessageDto[];
  nextCursor: MessageCursor | null;
};

/** Newest message someone else sent this account, without the text. */
export type MessageNotice = {
  conversationId: string;
  messageId: number;
  name: string;
};

export type MessagingSummary = {
  total: number;
  own: number;
  inbox: number;
  ownedSlugs: string[];
  notice: MessageNotice | null;
};

export const EMPTY_MESSAGING: MessagingSummary = {
  total: 0,
  own: 0,
  inbox: 0,
  ownedSlugs: [],
  notice: null,
};

export type ReportRow = {
  id: string;
  status: "new" | "reviewed" | "dismissed";
  reason: string;
  comment: string;
  reporterSide: "client" | "trainer";
  createdAt: string;
  messageId: number | null;
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

export function messageListPreview(body: string, fileCount = 0) {
  const text = messagePreview(body);
  if (text) return text;
  return fileCount > 0 ? "Вложение" : "";
}
