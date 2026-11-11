import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { consumeRateLimit } from "@/auth/rate-limit";
import { getDb } from "@/db";
import {
  blockedPairs,
  conversationReads,
  conversations,
  messageAttachments,
  messageReports,
  messages,
  trainerProfiles,
  users,
  type Conversation,
} from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { storedGivenName } from "@/lib/auth/login-name";
import { reviewPlainText, reviewTextLength, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import { isGodUser } from "@/lib/auth/god";
import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import {
  ATTACHMENT_TOO_MANY,
  ATTACHMENT_UNREADABLE,
  MESSAGE_ATTACHMENT_MAX_COUNT,
  decodeAttachmentDataUrl,
  sniffAttachment,
} from "@/lib/messages/attachments";
import { removeMessageFile, writeMessageFile, writeMessagePreview } from "@/lib/messages/attachment-store";
import { logCaught } from "@/lib/log/logger";
import { notifyStaffAboutReport, scheduleMessageNotification } from "@/lib/messages/notify";
import { messageEditable, messageSearchPattern, pickPairThread } from "@/lib/messages/pair";

const hostUsers = alias(users, "conversation_hosts");
import {
  CONVERSATION_PAGE_SIZE,
  DAILY_TRAINER_LIMIT_MESSAGE,
  DAILY_TRAINER_MESSAGE_LIMIT,
  FIRST_MESSAGE_MAX_LENGTH,
  MESSAGE_HTML_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  REPORT_COMMENT_MAX_LENGTH,
  REPORT_REASONS,
  type ConversationCursor,
  type ConversationListResult,
  type CounterpartDto,
  type MessageAttachmentDto,
  type MessageCursor,
  type MessageDto,
  type MessageQuoteDto,
  type MessagingSummary,
  type ReportRow,
  type ThreadResult,
  messageListPreview,
  messagePreview,
} from "@/lib/messages/schemas";

export type MessageActor = {
  id: string;
  roles: UserRole[];
};

export type ConversationAccess = {
  userId: string;
  ownerUserId: string | null;
  status: "open" | "closed";
  blocked: boolean;
  published: boolean;
};

type AccessMode = "read" | "write" | "close" | "reopen" | "block";

export function assertConversationAccess(actor: MessageActor, row: ConversationAccess, mode: AccessMode): void {
  if (isGodUser(actor.id)) return;
  const staff = isStaff(actor.roles);
  const participant = actor.id === row.userId || (row.ownerUserId != null && actor.id === row.ownerUserId);
  if (mode === "read") {
    if (participant || staff) return;
    throw new AuthError("Нет доступа к этой переписке.", "FORBIDDEN");
  }
  if (mode === "write") {
    if (!participant) throw new AuthError("Нет доступа к этой переписке.", "FORBIDDEN");
    if (row.status !== "open") throw new AuthError("Переписка закрыта.", "VALIDATION");
    if (row.blocked) throw new AuthError("Переписка с этим профилем недоступна.", "FORBIDDEN");
    if (!row.published) throw new AuthError("Этот профиль пока не принимает сообщения.", "VALIDATION");
    return;
  }
  if (mode === "close") {
    const owner = row.ownerUserId != null && actor.id === row.ownerUserId;
    if (owner || staff) return;
    throw new AuthError("Закрыть переписку может тренер или администратор.", "FORBIDDEN");
  }
  if (mode === "reopen") {
    if (!staff) throw new AuthError("Открыть переписку может только администратор.", "FORBIDDEN");
    return;
  }
  if (!staff) throw new AuthError("Недостаточно прав.", "FORBIDDEN");
}

export function canMessage(input: {
  actorId: string;
  ownerUserId: string | null;
  published: boolean;
  blocked: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (isGodUser(input.actorId)) return { ok: true };
  if (input.ownerUserId && input.actorId === input.ownerUserId) {
    return { ok: false, message: "Нельзя написать своему профилю." };
  }
  if (!input.published) return { ok: false, message: "Этот профиль пока не принимает сообщения." };
  if (input.blocked) return { ok: false, message: "Переписка с этим профилем недоступна." };
  return { ok: true };
}

export function cardPortrait(avatarPath: string, photos: readonly string[] | null | undefined) {
  const raw = photos?.find((item) => item.trim()) || avatarPath || "";
  return raw.split("?")[0].trim();
}

export function publicTrainerHref(slug: string, status: string) {
  if (status !== "published" || !slug) return null;
  return `/trainers/${slug}`;
}

export function portraitPath(cardPath: string, accountPath: string) {
  return cardPath.trim() || accountPath.trim();
}

export function getCounterparty(input: {
  viewerId: string;
  conversationUserId: string;
  userName: string;
  userFirstName: string;
  userLastName: string;
  userAvatarPath: string;
  userHref: string | null;
  trainerName: string;
  trainerFirstName: string;
  trainerLastName: string;
  trainerAvatarPath: string;
  trainerSlug: string;
  trainerHref: string | null;
}): CounterpartDto {
  if (input.viewerId === input.conversationUserId) {
    return {
      name: input.trainerName,
      firstName: input.trainerFirstName,
      lastName: input.trainerLastName,
      avatarPath: input.trainerAvatarPath,
      slug: input.trainerSlug || null,
      href: input.trainerHref,
      kind: "trainer",
    };
  }
  return {
    name: input.userName,
    firstName: input.userFirstName,
    lastName: input.userLastName,
    avatarPath: input.userAvatarPath,
    slug: null,
    href: input.userHref,
    kind: "user",
  };
}

type OwnedFace = { avatarPath: string; href: string | null };

async function facesByOwner(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const faces = new Map<string, OwnedFace>();
  if (ids.length === 0) return faces;
  const rows = await getDb()
    .select({
      ownerUserId: trainerProfiles.ownerUserId,
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
      updatedAt: trainerProfiles.updatedAt,
    })
    .from(trainerProfiles)
    .where(inArray(trainerProfiles.ownerUserId, ids));
  const best = new Map<string, (typeof rows)[number]>();
  const rank = (status: string) => (status === "published" ? 2 : status === "archived" ? -1 : 1);
  for (const row of rows) {
    if (!row.ownerUserId || rank(row.status) < 0) continue;
    const current = best.get(row.ownerUserId);
    if (
      !current
      || rank(row.status) > rank(current.status)
      || (rank(row.status) === rank(current.status) && row.updatedAt > current.updatedAt)
    ) {
      best.set(row.ownerUserId, row);
    }
  }
  for (const [id, row] of best) {
    faces.set(id, {
      avatarPath: cardPortrait(row.avatarPath, row.photos),
      href: publicTrainerHref(row.slug, row.status),
    });
  }
  return faces;
}

function allows(actor: MessageActor, row: ConversationAccess, mode: AccessMode) {
  try {
    assertConversationAccess(actor, row, mode);
    return true;
  } catch {
    return false;
  }
}

function isParticipant(actorId: string, row: ConversationAccess) {
  return actorId === row.userId || (row.ownerUserId != null && actorId === row.ownerUserId);
}

function personName(firstName: string | null | undefined, lastName: string | null | undefined, email?: string | null) {
  const given = storedGivenName(firstName, email);
  return [given, lastName].filter(Boolean).join(" ") || "Пользователь";
}

function trainerLabel(fullName: string, firstName: string, lastName: string) {
  return fullName.trim() || personName(firstName, lastName) || "Тренер";
}

function listedTrainer(row: {
  trainerFullName: string | null;
  trainerFirstName: string | null;
  trainerLastName: string | null;
  trainerAvatar: string | null;
  trainerSlug: string | null;
  hostUserId: string | null;
  hostAvatar: string | null;
}) {
  if (!row.trainerSlug && row.hostUserId) {
    return {
      name: "Trenioby",
      firstName: "Trenioby",
      lastName: "",
      avatarPath: row.hostAvatar ?? "",
      slug: "",
    };
  }
  return {
    name: trainerLabel(row.trainerFullName ?? "", row.trainerFirstName ?? "", row.trainerLastName ?? ""),
    firstName: row.trainerFirstName ?? "",
    lastName: row.trainerLastName ?? "",
    avatarPath: row.trainerAvatar ?? "",
    slug: row.trainerSlug ?? "",
  };
}

function asNumber(value: number | string | bigint) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isUniqueViolation(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function assertSendRate(userId: string) {
  if (isGodUser(userId)) return;
  const minute = await consumeRateLimit(`msg:min:${userId}`, 60_000, 10);
  if (!minute.ok) {
    throw new AuthError(`Слишком много сообщений. Подождите ${minute.retryAfterSec} с.`, "RATE_LIMITED");
  }
  const day = await consumeRateLimit(`msg:day:${userId}`, 24 * 60 * 60_000, 300);
  if (!day.ok) throw new AuthError("Достигнут дневной лимит сообщений. Попробуйте завтра.", "RATE_LIMITED");
}

/** Messages this user already sent today, as the client of the thread. Replies from a profile owner are not counted. */
async function assertDailyTrainerOutreach(userId: string, trainerProfileId: string) {
  if (isGodUser(userId)) return;
  const [row] = await getDb()
    .select({
      trainers: sql<number>`count(distinct ${conversations.trainerProfileId})::int`,
      includes: sql<boolean>`coalesce(bool_or(${conversations.trainerProfileId} = ${trainerProfileId}), false)`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.senderId, userId),
        eq(conversations.userId, userId),
        sql`(${messages.createdAt} at time zone 'Europe/Minsk')::date = (now() at time zone 'Europe/Minsk')::date`,
      ),
    );
  const trainers = Number(row?.trainers ?? 0);
  const includes = row?.includes === true || row?.includes === "t" || row?.includes === "true";
  if (!includes && trainers >= DAILY_TRAINER_MESSAGE_LIMIT) {
    throw new AuthError(DAILY_TRAINER_LIMIT_MESSAGE, "RATE_LIMITED");
  }
}

type ProfileRow = {
  id: string;
  slug: string;
  status: string;
  ownerUserId: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  avatarPath: string;
};

async function profileBySlug(slug: string): Promise<ProfileRow | null> {
  const [row] = await getDb()
    .select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
      ownerUserId: trainerProfiles.ownerUserId,
      fullName: trainerProfiles.fullName,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      avatarPath: trainerProfiles.avatarPath,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.slug, slug))
    .limit(1);
  return row ?? null;
}

async function isBlocked(userId: string, trainerProfileId: string) {
  const [row] = await getDb()
    .select({ userId: blockedPairs.userId })
    .from(blockedPairs)
    .where(and(eq(blockedPairs.userId, userId), eq(blockedPairs.trainerProfileId, trainerProfileId)))
    .limit(1);
  return Boolean(row);
}

function accessFrom(conversation: Conversation, profile: ProfileRow, blocked: boolean): ConversationAccess {
  return {
    userId: conversation.userId,
    ownerUserId: profile.ownerUserId,
    status: conversation.status,
    blocked,
    published: profile.status === "published",
  };
}

async function profileById(id: string): Promise<ProfileRow | null> {
  const [row] = await getDb()
    .select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
      ownerUserId: trainerProfiles.ownerUserId,
      fullName: trainerProfiles.fullName,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      avatarPath: trainerProfiles.avatarPath,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.id, id))
    .limit(1);
  return row ?? null;
}

/** The welcome thread has no trainer card. The other party is the admin account, shown as Trenioby. */
async function portalProfile(hostUserId: string | null): Promise<ProfileRow | null> {
  if (!hostUserId) return null;
  const [user] = await getDb()
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, hostUserId))
    .limit(1);
  if (!user) return null;
  return {
    id: hostUserId,
    slug: "",
    status: "published",
    ownerUserId: hostUserId,
    fullName: "Trenioby",
    firstName: "Trenioby",
    lastName: "",
    avatarPath: user.avatarPath,
  };
}

async function loadConversation(conversationId: string) {
  const [conversation] = await getDb().select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return null;
  const profile = conversation.trainerProfileId
    ? await profileById(conversation.trainerProfileId)
    : await portalProfile(conversation.hostUserId);
  if (!profile) return null;
  const blocked = conversation.trainerProfileId
    ? await isBlocked(conversation.userId, conversation.trainerProfileId)
    : false;
  return { conversation, profile, access: accessFrom(conversation, profile, blocked) };
}

export async function requireConversation(actor: MessageActor, conversationId: string, mode: AccessMode) {
  const loaded = await loadConversation(conversationId);
  if (!loaded) {
    throw new AuthError(isStaff(actor.roles) ? "Переписка не найдена." : "Нет доступа к этой переписке.", "FORBIDDEN");
  }
  assertConversationAccess(actor, loaded.access, mode);
  return loaded;
}

async function findOpen(userId: string, trainerProfileId: string) {
  const [row] = await getDb()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.trainerProfileId, trainerProfileId),
        eq(conversations.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function openOrCreate(actorId: string, profile: ProfileRow) {
  const blocked = await isBlocked(actorId, profile.id);
  const gate = canMessage({
    actorId,
    ownerUserId: profile.ownerUserId,
    published: profile.status === "published",
    blocked,
  });
  if (!gate.ok) throw new AuthError(gate.message, "FORBIDDEN");

  const existing = await findOpen(actorId, profile.id);
  if (existing) {
    if (existing.userHiddenAt) {
      await getDb().update(conversations).set({ userHiddenAt: null }).where(eq(conversations.id, existing.id));
    }
    return existing;
  }

  await assertDailyTrainerOutreach(actorId, profile.id);
  try {
    const [created] = await getDb()
      .insert(conversations)
      .values({ userId: actorId, trainerProfileId: profile.id, status: "open" })
      .returning();
    if (!created) throw new AuthError("Не удалось открыть переписку.", "VALIDATION");
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const again = await findOpen(actorId, profile.id);
    if (!again) throw error;
    return again;
  }
}

async function messageCounts(ids: string[]) {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const rows = await getDb()
    .select({
      conversationId: messages.conversationId,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(inArray(messages.conversationId, ids))
    .groupBy(messages.conversationId);
  for (const row of rows) counts.set(row.conversationId, Number(row.count));
  return counts;
}

/** The same two accounts already share a thread, including the portal welcome. */
async function openExistingPair(actorId: string, profile: ProfileRow) {
  const ownerId = profile.ownerUserId;
  if (!ownerId || ownerId === actorId) return null;
  const rows = await getDb()
    .select({
      id: conversations.id,
      trainerProfileId: conversations.trainerProfileId,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      userHiddenAt: conversations.userHiddenAt,
    })
    .from(conversations)
    .leftJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .where(and(
      eq(conversations.status, "open"),
      or(
        and(
          eq(conversations.userId, actorId),
          or(eq(conversations.hostUserId, ownerId), eq(trainerProfiles.ownerUserId, ownerId)),
        ),
        and(
          eq(conversations.userId, ownerId),
          or(eq(conversations.hostUserId, actorId), eq(trainerProfiles.ownerUserId, actorId)),
        ),
      ),
    ));
  const counts = await messageCounts(rows.map((row) => row.id));
  const picked = pickPairThread(
    rows.map((row) => ({
      id: row.id,
      trainerProfileId: row.trainerProfileId,
      messages: counts.get(row.id) ?? 0,
      activityAt: (row.lastMessageAt ?? row.createdAt).getTime(),
    })),
    profile.id,
  );
  if (!picked) return null;
  if (picked.dropIds.length > 0) {
    const [files, reports] = await Promise.all([
      getDb().select({ conversationId: messageAttachments.conversationId }).from(messageAttachments).where(inArray(messageAttachments.conversationId, picked.dropIds)),
      getDb().select({ conversationId: messageReports.conversationId }).from(messageReports).where(inArray(messageReports.conversationId, picked.dropIds)),
    ]);
    const busy = new Set([...files, ...reports].map((row) => row.conversationId));
    const safe = picked.dropIds.filter((id) => !busy.has(id));
    if (safe.length > 0) {
      await getDb().delete(conversations).where(inArray(conversations.id, safe)).catch((error) => {
        logCaught("message", "message.ensure", error, { target: picked.keepId });
      });
    }
  }
  const kept = rows.find((row) => row.id === picked.keepId);
  if (kept?.userHiddenAt) {
    await getDb().update(conversations).set({ userHiddenAt: null }).where(eq(conversations.id, kept.id));
  }
  return { id: picked.keepId, dropped: picked.dropIds.length };
}

export async function ensureConversation(actor: MessageActor, trainerProfileSlug: string) {
  const profile = await profileBySlug(trainerProfileSlug);
  if (!profile) throw new AuthError("Профиль не найден.", "VALIDATION");
  const paired = await openExistingPair(actor.id, profile);
  if (paired) return { conversationId: paired.id, dropped: paired.dropped };
  const conversation = await openOrCreate(actor.id, profile);
  return { conversationId: conversation.id, dropped: 0 };
}

async function attachmentDtos(messageIds: number[]) {
  const grouped = new Map<number, MessageAttachmentDto[]>();
  if (messageIds.length === 0) return grouped;
  const rows = await getDb()
    .select({
      id: messageAttachments.id,
      messageId: messageAttachments.messageId,
      name: messageAttachments.originalName,
      mime: messageAttachments.mime,
      byteSize: messageAttachments.byteSize,
    })
    .from(messageAttachments)
    .where(inArray(messageAttachments.messageId, messageIds));
  for (const row of rows) {
    if (row.messageId == null) continue;
    const list = grouped.get(row.messageId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      mime: row.mime,
      byteSize: row.byteSize,
      kind: row.mime.startsWith("image/") ? "image" : "file",
    });
    grouped.set(row.messageId, list);
  }
  return grouped;
}

function quotePreview(body: string, deleted: boolean) {
  if (deleted) return "Сообщение удалено";
  return messagePreview(body) || "Вложение";
}

async function quotesById(ids: number[]) {
  const unique = [...new Set(ids)];
  const map = new Map<number, { id: number; body: string; deletedAt: Date | null }>();
  if (unique.length === 0) return map;
  const rows = await getDb()
    .select({ id: messages.id, body: messages.body, deletedAt: messages.deletedAt })
    .from(messages)
    .where(inArray(messages.id, unique));
  for (const row of rows) map.set(asNumber(row.id), { id: asNumber(row.id), body: row.body, deletedAt: row.deletedAt });
  return map;
}

async function toMessageDto(row: {
  id: number | string;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: Date | string;
  editedAt?: Date | string | null;
  deletedAt: Date | string | null;
  replyToId?: number | string | null;
}, actor: MessageActor, conversationUserId: string, staffSeesBody: boolean, readUpTo: number | null, files: MessageAttachmentDto[] = [], quote?: MessageQuoteDto | null): Promise<MessageDto> {
  const deleted = row.deletedAt != null;
  const id = asNumber(row.id);
  const mine = row.senderId === actor.id;
  const createdAt = iso(row.createdAt) ?? new Date(0).toISOString();
  return {
    id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: deleted && !staffSeesBody ? "" : row.body,
    clientId: row.clientId,
    createdAt,
    editedAt: iso(row.editedAt ?? null),
    canEdit: messageEditable(createdAt, mine, deleted),
    replyTo: deleted && !staffSeesBody ? null : quote ?? null,
    deleted,
    mine,
    side: row.senderId === conversationUserId ? "user" : "trainer",
    receipt: !mine || deleted ? null : readUpTo != null && id <= readUpTo ? "read" : "delivered",
    attachments: deleted && !staffSeesBody ? [] : files,
  };
}

async function viewerReadUpTo(actorId: string, conversationId: string) {
  const [read] = await getDb()
    .select({ id: conversationReads.lastReadMessageId })
    .from(conversationReads)
    .where(and(eq(conversationReads.conversationId, conversationId), eq(conversationReads.userId, actorId)))
    .limit(1);
  return read?.id == null ? null : asNumber(read.id);
}

async function counterpartReadUpTo(actor: MessageActor, conversation: Conversation, ownerUserId: string | null) {
  const otherId = actor.id === conversation.userId
    ? ownerUserId
    : ownerUserId != null && actor.id === ownerUserId
      ? conversation.userId
      : null;
  if (!otherId) return null;
  const [read] = await getDb()
    .select({ id: conversationReads.lastReadMessageId })
    .from(conversationReads)
    .where(and(eq(conversationReads.conversationId, conversation.id), eq(conversationReads.userId, otherId)))
    .limit(1);
  return read?.id == null ? null : asNumber(read.id);
}

async function readyAttachments(actorId: string, conversationId: string, clientId: string, attachmentIds: string[]) {
  if (attachmentIds.length > MESSAGE_ATTACHMENT_MAX_COUNT) throw new AuthError(ATTACHMENT_TOO_MANY, "VALIDATION");
  if (attachmentIds.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(messageAttachments)
    .where(inArray(messageAttachments.id, attachmentIds));
  if (rows.length !== attachmentIds.length) throw new AuthError("Файл не найден. Прикрепите его ещё раз.", "VALIDATION");
  for (const row of rows) {
    if (row.uploaderId !== actorId || row.conversationId !== conversationId || row.clientId !== clientId) {
      throw new AuthError("Файл не найден. Прикрепите его ещё раз.", "VALIDATION");
    }
  }
  return rows;
}

export async function uploadMessageFile(
  actor: MessageActor,
  input: { id: string; conversationId: string; clientId: string; fileName: string; dataUrl: string },
) {
  await requireConversation(actor, input.conversationId, "write");
  const [existing] = await getDb()
    .select({
      id: messageAttachments.id,
      uploaderId: messageAttachments.uploaderId,
      clientId: messageAttachments.clientId,
      messageId: messageAttachments.messageId,
    })
    .from(messageAttachments)
    .where(eq(messageAttachments.id, input.id))
    .limit(1);
  if (existing) {
    if (existing.uploaderId !== actor.id || existing.messageId != null) {
      throw new AuthError(existing.messageId != null ? "Файл уже отправлен." : "Файл не найден. Прикрепите его ещё раз.", "VALIDATION");
    }
    if (existing.clientId !== input.clientId) {
      await getDb()
        .update(messageAttachments)
        .set({ clientId: input.clientId })
        .where(eq(messageAttachments.id, existing.id));
    }
    return { id: existing.id };
  }
  const decoded = decodeAttachmentDataUrl(input.dataUrl);
  if (!decoded) throw new AuthError(ATTACHMENT_UNREADABLE, "VALIDATION");
  const sniffed = sniffAttachment(decoded.bytes, input.fileName, decoded.mime);
  if (!sniffed.ok) throw new AuthError(sniffed.message, "VALIDATION");
  const [countRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(messageAttachments)
    .where(and(eq(messageAttachments.conversationId, input.conversationId), eq(messageAttachments.clientId, input.clientId)));
  if (Number(countRow?.count ?? 0) >= MESSAGE_ATTACHMENT_MAX_COUNT) throw new AuthError(ATTACHMENT_TOO_MANY, "VALIDATION");
  const minute = await consumeRateLimit(`msg:file:${actor.id}`, 60_000, 30);
  if (!minute.ok) throw new AuthError(`Слишком много файлов. Подождите ${minute.retryAfterSec} с.`, "RATE_LIMITED");
  const byteSize = await writeMessageFile(input.conversationId, input.id, sniffed.file.ext, decoded.bytes);
  if (sniffed.file.kind === "image") {
    await writeMessagePreview(input.conversationId, input.id, decoded.bytes).catch((error) => {
      logCaught("message", "message.file", error, { target: input.conversationId });
    });
  }
  try {
    await getDb().insert(messageAttachments).values({
      id: input.id,
      conversationId: input.conversationId,
      uploaderId: actor.id,
      clientId: input.clientId,
      originalName: sniffed.file.name,
      mime: sniffed.file.mime,
      byteSize,
      ext: sniffed.file.ext,
    });
  } catch (error) {
    await removeMessageFile(input.conversationId, input.id, sniffed.file.ext);
    if (isUniqueViolation(error)) return { id: input.id };
    throw error;
  }
  return { id: input.id, bytes: byteSize, ext: sniffed.file.ext };
}

export async function sendMessage(
  actor: MessageActor,
  input: { conversationId?: string; trainerProfileSlug?: string; body: string; clientId: string; attachmentIds?: string[]; replyToId?: number },
) {
  let conversationId = input.conversationId;
  if (!conversationId) {
    if (!input.trainerProfileSlug) throw new AuthError("Не указана переписка.", "VALIDATION");
    conversationId = (await ensureConversation(actor, input.trainerProfileSlug)).conversationId;
  }
  const loaded = await requireConversation(actor, conversationId, "write");
  const attachmentIds = input.attachmentIds ?? [];
  const html = sanitizeReviewHtml(input.body);
  const plain = reviewPlainText(html);
  const stored = plain ? html : "";
  if (!plain && attachmentIds.length === 0) throw new AuthError("Введите сообщение.", "VALIDATION");
  if (html.length > MESSAGE_HTML_MAX_LENGTH) throw new AuthError("Сообщение слишком длинное.", "VALIDATION");
  await readyAttachments(actor.id, conversationId, input.clientId, attachmentIds);
  let limit = MESSAGE_MAX_LENGTH;
  if (actor.id === loaded.conversation.userId) {
    const [prior] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderId, actor.id),
          isNull(messages.deletedAt),
        ),
      )
      .limit(1);
    if (!prior) limit = FIRST_MESSAGE_MAX_LENGTH;
  }
  if (plain && reviewTextLength(html) > limit) {
    throw new AuthError(
      limit === FIRST_MESSAGE_MAX_LENGTH
        ? `Первое сообщение тренеру — не длиннее ${FIRST_MESSAGE_MAX_LENGTH} символов.`
        : `Сообщение не длиннее ${MESSAGE_MAX_LENGTH} символов.`,
      "VALIDATION",
    );
  }

  if (actor.id === loaded.conversation.userId) {
    const [duplicate] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.clientId, input.clientId)))
      .limit(1);
    if (!duplicate && loaded.conversation.trainerProfileId) {
      await assertDailyTrainerOutreach(actor.id, loaded.conversation.trainerProfileId);
    }
  }
  let replyToId: number | null = null;
  if (input.replyToId) {
    const [target] = await getDb()
      .select({ id: messages.id, conversationId: messages.conversationId, deletedAt: messages.deletedAt })
      .from(messages)
      .where(eq(messages.id, input.replyToId))
      .limit(1);
    if (!target || target.conversationId !== conversationId || target.deletedAt) {
      throw new AuthError("Нельзя ответить на это сообщение.", "VALIDATION");
    }
    replyToId = asNumber(target.id);
  }
  assertSendRate(actor.id);
  const saved = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId: actor.id,
        body: stored,
        clientId: input.clientId,
        replyToId,
      })
      .onConflictDoNothing({ target: [messages.conversationId, messages.clientId] })
      .returning();
    const created = inserted[0];
    if (!created) {
      const [existing] = await tx
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.clientId, input.clientId)))
        .limit(1);
      if (!existing) throw new AuthError("Не удалось отправить сообщение.", "VALIDATION");
      return { row: existing, duplicate: true };
    }
    await tx
      .update(conversations)
      .set({ lastMessageAt: created.createdAt, userHiddenAt: null })
      .where(eq(conversations.id, conversationId));
    if (attachmentIds.length > 0) {
      const ready = await tx
        .select({ id: messageAttachments.id, messageId: messageAttachments.messageId })
        .from(messageAttachments)
        .where(inArray(messageAttachments.id, attachmentIds));
      if (ready.length !== attachmentIds.length) throw new AuthError("Файл не найден. Прикрепите его ещё раз.", "VALIDATION");
      const messageId = asNumber(created.id);
      if (ready.some((row) => row.messageId != null && row.messageId !== messageId)) {
        throw new AuthError("Файл уже отправлен.", "VALIDATION");
      }
      await tx
        .update(messageAttachments)
        .set({ messageId })
        .where(and(
          inArray(messageAttachments.id, attachmentIds),
          eq(messageAttachments.uploaderId, actor.id),
          eq(messageAttachments.conversationId, conversationId),
          eq(messageAttachments.clientId, input.clientId),
        ));
    }
    return { row: created, duplicate: false };
  });

  if (!saved.duplicate) {
    const recipientId = actor.id === loaded.conversation.userId ? loaded.profile.ownerUserId : loaded.conversation.userId;
    if (recipientId && recipientId !== actor.id) {
      scheduleMessageNotification({
        conversationId,
        messageId: asNumber(saved.row.id),
        recipientId,
      });
    }
  }

  const files = await attachmentDtos([asNumber(saved.row.id)]);
  const quoteId = saved.row.replyToId == null ? null : asNumber(saved.row.replyToId);
  const quotes = await quotesById(quoteId == null ? [] : [quoteId]);
  const quoted = quoteId == null ? null : quotes.get(quoteId);
  return {
    message: await toMessageDto(
      saved.row,
      actor,
      loaded.conversation.userId,
      false,
      null,
      files.get(asNumber(saved.row.id)) ?? [],
      quoted ? { id: quoted.id, preview: quotePreview(quoted.body, quoted.deletedAt != null) } : null,
    ),
    duplicate: saved.duplicate,
  };
}

export async function editMessage(actor: MessageActor, input: { messageId: number; body: string }) {
  const [row] = await getDb().select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
  if (!row || row.deletedAt) throw new AuthError("Сообщение не найдено.", "VALIDATION");
  if (row.senderId !== actor.id) throw new AuthError("Можно изменить только своё сообщение.", "FORBIDDEN");
  const createdAt = iso(row.createdAt) ?? "";
  if (!messageEditable(createdAt, true, false)) {
    throw new AuthError("Сообщение можно изменить в течение 15 минут.", "VALIDATION");
  }
  const loaded = await requireConversation(actor, row.conversationId, "write");
  const html = sanitizeReviewHtml(input.body);
  const plain = reviewPlainText(html);
  if (!plain) throw new AuthError("Введите сообщение.", "VALIDATION");
  if (html.length > MESSAGE_HTML_MAX_LENGTH) throw new AuthError("Сообщение слишком длинное.", "VALIDATION");
  let limit = MESSAGE_MAX_LENGTH;
  if (actor.id === loaded.conversation.userId) {
    const [prior] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(and(
        eq(messages.conversationId, row.conversationId),
        eq(messages.senderId, actor.id),
        isNull(messages.deletedAt),
        sql`${messages.id} < ${asNumber(row.id)}`,
      ))
      .limit(1);
    if (!prior) limit = FIRST_MESSAGE_MAX_LENGTH;
  }
  if (reviewTextLength(html) > limit) {
    throw new AuthError(
      limit === FIRST_MESSAGE_MAX_LENGTH
        ? `Первое сообщение тренеру — не длиннее ${FIRST_MESSAGE_MAX_LENGTH} символов.`
        : `Сообщение не длиннее ${MESSAGE_MAX_LENGTH} символов.`,
      "VALIDATION",
    );
  }
  const [saved] = await getDb()
    .update(messages)
    .set({ body: html, editedAt: new Date() })
    .where(eq(messages.id, asNumber(row.id)))
    .returning();
  if (!saved) throw new AuthError("Не удалось изменить сообщение.", "VALIDATION");
  const files = await attachmentDtos([asNumber(saved.id)]);
  const quoteId = saved.replyToId == null ? null : asNumber(saved.replyToId);
  const quotes = await quotesById(quoteId == null ? [] : [quoteId]);
  const quoted = quoteId == null ? null : quotes.get(quoteId);
  const readUpTo = await counterpartReadUpTo(actor, loaded.conversation, loaded.profile.ownerUserId);
  return {
    message: await toMessageDto(
      saved,
      actor,
      loaded.conversation.userId,
      false,
      readUpTo,
      files.get(asNumber(saved.id)) ?? [],
      quoted ? { id: quoted.id, preview: quotePreview(quoted.body, quoted.deletedAt != null) } : null,
    ),
  };
}

function lastMessageReceipt(
  last: { id: number; senderId: string } | undefined,
  conversation: { id: string; userId: string; ownerUserId: string | null; hostUserId: string | null },
  readCursor: Map<string, number>,
): "delivered" | "read" | null {
  if (!last) return null;
  const addresseeId = last.senderId === conversation.userId
    ? conversation.ownerUserId ?? conversation.hostUserId
    : conversation.userId;
  if (!addresseeId) return "delivered";
  const cursor = readCursor.get(`${conversation.id}:${addresseeId}`);
  return cursor != null && last.id <= cursor ? "read" : "delivered";
}

const activityAt = sql<Date>`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;

export async function listConversations(
  actor: MessageActor,
  input: { view: "own" | "inbox" | "staff"; cursor?: ConversationCursor; query?: string },
): Promise<ConversationListResult> {
  if (input.view === "staff" && !isStaff(actor.roles)) {
    throw new AuthError("Недостаточно прав.", "FORBIDDEN");
  }
  if (input.view === "inbox" && !actor.roles.some((role) => role === "trainer" || role === "club" || role === "admin" || role === "superadmin")) {
    throw new AuthError("Нет доступа к перепискам профиля.", "FORBIDDEN");
  }
  const filters = [];
  if (input.view === "own") filters.push(eq(conversations.userId, actor.id));
  if (input.view === "inbox") {
    filters.push(or(
      eq(conversations.userId, actor.id),
      eq(trainerProfiles.ownerUserId, actor.id),
      eq(conversations.hostUserId, actor.id),
    ));
  }
  if (input.cursor) {
    const at = new Date(input.cursor.at);
    if (Number.isNaN(at.getTime())) throw new AuthError("Некорректная страница.", "VALIDATION");
    filters.push(sql`(${activityAt}, ${conversations.id}) < (${at.toISOString()}::timestamptz, ${input.cursor.id}::uuid)`);
  }
  const pattern = messageSearchPattern(input.query);
  if (pattern) {
    filters.push(sql`(
      ${users.firstName} ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(${users.lastName}, '') ILIKE ${pattern} ESCAPE '\\'
      OR (${users.firstName} || ' ' || coalesce(${users.lastName}, '')) ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(${trainerProfiles.fullName}, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(${trainerProfiles.firstName}, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(${trainerProfiles.lastName}, '') ILIKE ${pattern} ESCAPE '\\'
      OR coalesce(${hostUsers.firstName}, '') ILIKE ${pattern} ESCAPE '\\'
      OR (${hostUsers.firstName} || ' ' || coalesce(${hostUsers.lastName}, '')) ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM messages AS found
        WHERE found.conversation_id = ${conversations.id}
          AND found.deleted_at IS NULL
          AND found.body ILIKE ${pattern} ESCAPE '\\'
      )
    )`);
  }
  const rows = await getDb()
    .select({
      id: conversations.id,
      status: conversations.status,
      userId: conversations.userId,
      activityAt,
      trainerSlug: trainerProfiles.slug,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      trainerAvatar: trainerProfiles.avatarPath,
      trainerStatus: trainerProfiles.status,
      ownerUserId: trainerProfiles.ownerUserId,
      hostUserId: conversations.hostUserId,
      hostAvatar: hostUsers.avatarPath,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userAvatar: users.avatarPath,
    })
    .from(conversations)
    .leftJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .leftJoin(hostUsers, eq(hostUsers.id, conversations.hostUserId))
    .innerJoin(users, eq(users.id, conversations.userId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(activityAt), desc(conversations.id))
    .limit(CONVERSATION_PAGE_SIZE + 1);

  const hasMore = rows.length > CONVERSATION_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CONVERSATION_PAGE_SIZE) : rows;
  const ids = page.map((row) => row.id);
  const previews = new Map<string, string>();
  const lastMessages = new Map<string, { id: number; senderId: string }>();
  const readCursor = new Map<string, number>();
  const unread = new Map<string, number>();
  if (ids.length > 0) {
    const previewRows = await getDb().execute<{ conversationId: string; messageId: number | string; senderId: string; body: string; files: number }>(sql`
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id AS "conversationId",
        m.id AS "messageId",
        m.sender_id AS "senderId",
        m.body,
        (SELECT count(*)::int FROM message_attachments a WHERE a.message_id = m.id) AS files
      FROM messages m
      WHERE m.conversation_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
        AND m.deleted_at IS NULL
      ORDER BY m.conversation_id, m.created_at DESC, m.id DESC
    `);
    for (const row of previewRows) {
      previews.set(row.conversationId, messageListPreview(row.body, asNumber(row.files)));
      lastMessages.set(row.conversationId, { id: asNumber(row.messageId), senderId: row.senderId });
    }

    const readRows = await getDb().execute<{ conversationId: string; userId: string; messageId: number | string }>(sql`
      SELECT
        conversation_id AS "conversationId",
        user_id AS "userId",
        last_read_message_id AS "messageId"
      FROM conversation_reads
      WHERE conversation_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    `);
    for (const row of readRows) readCursor.set(`${row.conversationId}:${row.userId}`, asNumber(row.messageId));

    const unreadRows = await getDb().execute<{ conversationId: string; count: number }>(sql`
      SELECT m.conversation_id AS "conversationId", count(*)::int AS count
      FROM messages m
      LEFT JOIN conversation_reads r
        ON r.conversation_id = m.conversation_id AND r.user_id = ${actor.id}::uuid
      WHERE m.conversation_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
        AND m.deleted_at IS NULL
        AND m.sender_id <> ${actor.id}::uuid
        AND (r.last_read_message_id IS NULL OR m.id > r.last_read_message_id)
      GROUP BY m.conversation_id
    `);
    for (const row of unreadRows) unread.set(row.conversationId, asNumber(row.count));
  }

  let total: number | undefined;
  if (input.view === "staff") {
    const [counted] = await getDb().select({ n: sql<number>`count(*)::int` }).from(conversations);
    total = Number(counted?.n ?? 0);
  }

  const faces = await facesByOwner(page.map((row) => row.userId));
  const items = page.map((row) => {
    const activity = iso(row.activityAt) ?? new Date(0).toISOString();
    const clientName = personName(row.userFirstName, row.userLastName, row.userEmail);
    const trainer = listedTrainer(row);
    const face = faces.get(row.userId);
    const trainerHref = publicTrainerHref(trainer.slug, row.trainerStatus ?? "");
    const counterpart = getCounterparty({
      viewerId: actor.id,
      conversationUserId: row.userId,
      userName: clientName,
      userFirstName: row.userFirstName,
      userLastName: row.userLastName ?? "",
      userAvatarPath: portraitPath(face?.avatarPath ?? "", row.userAvatar),
      userHref: face?.href ?? null,
      trainerName: trainer.name,
      trainerFirstName: trainer.firstName,
      trainerLastName: trainer.lastName,
      trainerAvatarPath: trainer.avatarPath,
      trainerSlug: trainer.slug,
      trainerHref,
    });
    const involved = row.userId === actor.id || row.ownerUserId === actor.id || row.hostUserId === actor.id;
    return {
      id: row.id,
      status: row.status,
      activityAt: activity,
      preview: previews.get(row.id) ?? "",
      unread: input.view === "staff" && !involved ? 0 : unread.get(row.id) ?? 0,
      receipt: lastMessageReceipt(lastMessages.get(row.id), row, readCursor),
      trainerSlug: trainer.slug,
      counterpart,
      aside: input.view === "staff" ? (counterpart.kind === "user" ? trainer.name : clientName) : undefined,
    };
  });
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { at: last.activityAt, id: last.id } : null,
    total,
  };
}

export async function listMessages(
  actor: MessageActor,
  input: { conversationId: string; cursor?: MessageCursor },
): Promise<ThreadResult> {
  const loaded = await requireConversation(actor, input.conversationId, "read");
  const filters = [eq(messages.conversationId, input.conversationId)];
  if (input.cursor) {
    const at = new Date(input.cursor.createdAt);
    if (Number.isNaN(at.getTime())) throw new AuthError("Некорректная страница.", "VALIDATION");
    filters.push(sql`(${messages.createdAt}, ${messages.id}) < (${at.toISOString()}::timestamptz, ${input.cursor.id})`);
  }
  const rows = await getDb()
    .select()
    .from(messages)
    .where(and(...filters))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(MESSAGE_PAGE_SIZE + 1);
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows;
  const staff = isStaff(actor.roles);
  const canWrite = allows(actor, loaded.access, "write");
  let composeLimit = canWrite ? 4000 : 0;
  if (canWrite && actor.id === loaded.conversation.userId) {
    const [prior] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, input.conversationId),
          eq(messages.senderId, actor.id),
          isNull(messages.deletedAt),
        ),
      )
      .limit(1);
    if (!prior) composeLimit = FIRST_MESSAGE_MAX_LENGTH;
  }
  const [user] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, loaded.conversation.userId))
    .limit(1);
  const face = (await facesByOwner([loaded.conversation.userId])).get(loaded.conversation.userId);
  const trainerHref = publicTrainerHref(loaded.profile.slug, loaded.profile.status);
  const oldest = page[page.length - 1];
  const messageIds = page.map((row) => asNumber(row.id));
  const replyIds = page.flatMap((row) => row.replyToId == null ? [] : [asNumber(row.replyToId)]);
  const [readUpTo, viewerReadMessageId, files, quotes] = await Promise.all([
    counterpartReadUpTo(actor, loaded.conversation, loaded.profile.ownerUserId),
    viewerReadUpTo(actor.id, loaded.conversation.id),
    attachmentDtos(messageIds),
    quotesById(replyIds),
  ]);
  return {
    conversationId: loaded.conversation.id,
    status: loaded.conversation.status,
    trainerName: trainerLabel(loaded.profile.fullName, loaded.profile.firstName, loaded.profile.lastName),
    trainerSlug: loaded.profile.slug,
    trainerHref,
    counterpart: getCounterparty({
      viewerId: actor.id,
      conversationUserId: loaded.conversation.userId,
      userName: personName(user?.firstName ?? "", user?.lastName, user?.email),
      userFirstName: user?.firstName ?? "",
      userLastName: user?.lastName ?? "",
      userAvatarPath: portraitPath(face?.avatarPath ?? "", user?.avatarPath ?? ""),
      userHref: face?.href ?? null,
      trainerName: trainerLabel(loaded.profile.fullName, loaded.profile.firstName, loaded.profile.lastName),
      trainerFirstName: loaded.profile.firstName,
      trainerLastName: loaded.profile.lastName,
      trainerAvatarPath: loaded.profile.avatarPath,
      trainerSlug: loaded.profile.slug,
      trainerHref,
    }),
    canWrite,
    canClose: allows(actor, loaded.access, "close"),
    canReopen: allows(actor, loaded.access, "reopen"),
    canBlock: Boolean(loaded.conversation.trainerProfileId) && allows(actor, loaded.access, "block"),
    canHide: false,
    canReport: isParticipant(actor.id, loaded.access),
    composeLimit,
    viewerReadMessageId,
    messages: await Promise.all(page.map((row) => {
      const quoted = row.replyToId == null ? null : quotes.get(asNumber(row.replyToId));
      return toMessageDto(
        row,
        actor,
        loaded.conversation.userId,
        staff,
        readUpTo,
        files.get(asNumber(row.id)) ?? [],
        quoted ? { id: quoted.id, preview: quotePreview(quoted.body, quoted.deletedAt != null) } : null,
      );
    })),
    nextCursor: hasMore && oldest
      ? { createdAt: iso(oldest.createdAt) ?? new Date(0).toISOString(), id: asNumber(oldest.id) }
      : null,
  };
}

export async function markConversationRead(actor: MessageActor, input: { conversationId: string; lastMessageId: number }) {
  const loaded = await loadConversation(input.conversationId);
  if (!loaded || !isParticipant(actor.id, loaded.access)) {
    throw new AuthError("Нет доступа к этой переписке.", "FORBIDDEN");
  }
  const [message] = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, input.lastMessageId), eq(messages.conversationId, input.conversationId)))
    .limit(1);
  if (!message) throw new AuthError("Сообщение не найдено.", "VALIDATION");
  await getDb()
    .insert(conversationReads)
    .values({
      conversationId: input.conversationId,
      userId: actor.id,
      lastReadMessageId: input.lastMessageId,
      lastReadAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [conversationReads.conversationId, conversationReads.userId],
      set: {
        lastReadMessageId: sql`GREATEST(${conversationReads.lastReadMessageId}, ${input.lastMessageId})`,
        lastReadAt: new Date(),
      },
    });
  if (actor.id === loaded.conversation.userId && loaded.conversation.userHiddenAt) {
    await getDb().update(conversations).set({ userHiddenAt: null }).where(eq(conversations.id, input.conversationId));
  }
  return { ok: true as const };
}

export async function closeConversation(actor: MessageActor, conversationId: string) {
  const loaded = await requireConversation(actor, conversationId, "close");
  await getDb().update(conversations).set({ status: "closed" }).where(eq(conversations.id, loaded.conversation.id));
  await reviewOpenReports(loaded.conversation.id);
  return { ok: true as const };
}

export async function reopenConversation(actor: MessageActor, conversationId: string) {
  const loaded = await requireConversation(actor, conversationId, "reopen");
  try {
    await getDb().update(conversations).set({ status: "open" }).where(eq(conversations.id, loaded.conversation.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthError("Уже есть открытая переписка с этим профилем.", "VALIDATION");
    }
    throw error;
  }
  return { ok: true as const };
}

export async function hideConversation(_actor: MessageActor, _conversationId: string) {
  throw new AuthError("Переписку нельзя скрыть или удалить.", "VALIDATION");
}

export async function reportMessage(actor: MessageActor, input: { conversationId: string; reason: string; comment: string }) {
  const loaded = await requireConversation(actor, input.conversationId, "read");
  if (!isParticipant(actor.id, loaded.access)) {
    throw new AuthError("Пожаловаться может только участник переписки.", "FORBIDDEN");
  }
  const reason = REPORT_REASONS.find((item) => item.id === input.reason);
  if (!reason) throw new AuthError("Укажите причину.", "VALIDATION");
  const comment = reviewPlainText(input.comment);
  if (!comment) throw new AuthError("Напишите комментарий.", "VALIDATION");
  if (reviewTextLength(comment) > REPORT_COMMENT_MAX_LENGTH) {
    throw new AuthError("Комментарий — не длиннее 1000 символов.", "VALIDATION");
  }
  const reporterSide = actor.id === loaded.conversation.userId ? "client" : "trainer";
  try {
    await getDb().insert(messageReports).values({
      conversationId: loaded.conversation.id,
      reporterId: actor.id,
      reason: reason.label,
      comment,
      reporterSide,
      status: "new",
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: true as const, duplicate: true };
  }
  const [reporter] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  try {
    await notifyStaffAboutReport({
      conversationId: loaded.conversation.id,
      reporterName: personName(reporter?.firstName, reporter?.lastName, reporter?.email),
      reporterAvatar: reporter?.avatarPath ?? "",
      reporterSide,
      trainerName: trainerLabel(loaded.profile.fullName, loaded.profile.firstName, loaded.profile.lastName),
      reason: reason.label,
      comment,
    });
  } catch (error) {
    logCaught("message", "message.report.notify", error, { target: loaded.conversation.id, actorUserId: actor.id });
  }
  return { ok: true as const, duplicate: false };
}

export async function listReports(actor: MessageActor): Promise<ReportRow[]> {
  if (!isStaff(actor.roles)) throw new AuthError("Недостаточно прав.", "FORBIDDEN");
  const rows = await getDb()
    .select({
      id: messageReports.id,
      status: messageReports.status,
      reason: messageReports.reason,
      comment: messageReports.comment,
      reporterSide: messageReports.reporterSide,
      createdAt: messageReports.createdAt,
      messageId: messageReports.messageId,
      body: messages.body,
      conversationId: messageReports.conversationId,
      conversationStatus: conversations.status,
      reporterId: messageReports.reporterId,
      reporterFirstName: users.firstName,
      reporterLastName: users.lastName,
      reporterEmail: users.email,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      trainerSlug: trainerProfiles.slug,
      trainerAvatar: trainerProfiles.avatarPath,
      hostUserId: conversations.hostUserId,
      hostAvatar: hostUsers.avatarPath,
    })
    .from(messageReports)
    .leftJoin(messages, eq(messages.id, messageReports.messageId))
    .innerJoin(conversations, eq(conversations.id, messageReports.conversationId))
    .leftJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .leftJoin(hostUsers, eq(hostUsers.id, conversations.hostUserId))
    .innerJoin(users, eq(users.id, messageReports.reporterId))
    .orderBy(desc(messageReports.createdAt));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    reason: row.reason,
    comment: row.comment,
    reporterSide: row.reporterSide === "trainer" ? "trainer" : "client",
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    messageId: row.messageId == null ? null : asNumber(row.messageId),
    preview: row.body ? messagePreview(row.body) : "Вся переписка",
    conversationId: row.conversationId,
    conversationStatus: row.conversationStatus,
    reporterId: row.reporterId,
    reporterName: personName(row.reporterFirstName, row.reporterLastName, row.reporterEmail),
    trainerName: listedTrainer(row).name,
    trainerSlug: listedTrainer(row).slug,
  }));
}

export async function dismissReport(actor: MessageActor, reportId: string) {
  if (!isStaff(actor.roles)) throw new AuthError("Недостаточно прав.", "FORBIDDEN");
  const [row] = await getDb()
    .update(messageReports)
    .set({ status: "dismissed" })
    .where(eq(messageReports.id, reportId))
    .returning({ id: messageReports.id });
  if (!row) throw new AuthError("Жалоба не найдена.", "VALIDATION");
  return { ok: true as const };
}

async function reviewOpenReports(conversationId: string) {
  await getDb()
    .update(messageReports)
    .set({ status: "reviewed" })
    .where(and(eq(messageReports.status, "new"), eq(messageReports.conversationId, conversationId)));
}

export async function blockPair(actor: MessageActor, conversationId: string) {
  const loaded = await requireConversation(actor, conversationId, "block");
  if (!loaded.conversation.trainerProfileId) {
    throw new AuthError("Этот диалог нельзя заблокировать.", "VALIDATION");
  }
  await getDb()
    .insert(blockedPairs)
    .values({ userId: loaded.conversation.userId, trainerProfileId: loaded.conversation.trainerProfileId })
    .onConflictDoNothing();
  await getDb().update(conversations).set({ status: "closed" }).where(eq(conversations.id, conversationId));
  await reviewOpenReports(conversationId);
  return { ok: true as const };
}

export async function unreadSummary(userId: string): Promise<MessagingSummary> {
  const [row] = await getDb().execute<{ own: number; inbox: number; owned: string[] | null }>(sql`
    SELECT
      (
        SELECT count(*)::int
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${userId}::uuid
        WHERE c.user_id = ${userId}::uuid
          AND m.deleted_at IS NULL
          AND m.sender_id <> ${userId}::uuid
          AND (r.last_read_message_id IS NULL OR m.id > r.last_read_message_id)
      ) AS own,
      (
        SELECT count(*)::int
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        LEFT JOIN trainer_profiles p ON p.id = c.trainer_profile_id
        LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${userId}::uuid
        WHERE (p.owner_user_id = ${userId}::uuid OR c.host_user_id = ${userId}::uuid)
          AND c.user_id <> ${userId}::uuid
          AND m.deleted_at IS NULL
          AND m.sender_id <> ${userId}::uuid
          AND (r.last_read_message_id IS NULL OR m.id > r.last_read_message_id)
      ) AS inbox,
      COALESCE((
        SELECT array_agg(slug) FROM trainer_profiles WHERE owner_user_id = ${userId}::uuid
      ), ARRAY[]::varchar[]) AS owned
  `);
  const own = asNumber(row?.own ?? 0);
  const inbox = asNumber(row?.inbox ?? 0);
  const owned = Array.isArray(row?.owned) ? row.owned.filter((slug) => typeof slug === "string") : [];
  const [fresh] = await getDb().execute<{
    message_id: number | string;
    conversation_id: string;
    sender_name: string | null;
  }>(sql`
    SELECT
      m.id AS message_id,
      m.conversation_id,
      CASE
        WHEN c.host_user_id IS NOT NULL AND m.sender_id = c.host_user_id THEN 'Trenioby'
        WHEN p.owner_user_id IS NOT NULL AND m.sender_id = p.owner_user_id THEN
          COALESCE(
            NULLIF(btrim(p.full_name), ''),
            NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
            'Тренер'
          )
        ELSE COALESCE(NULLIF(btrim(concat_ws(' ',
          CASE
            WHEN btrim(coalesce(su.first_name, '')) IN ('', 'Пользователь')
              AND su.email !~ '^pending\\.[0-9a-f-]{36}@users\\.trenio\\.invalid$'
              AND su.email !~ '^deleted\\.[0-9a-f-]{36}@users\\.trenio\\.invalid$'
              AND strpos(su.email, '@') > 1
            THEN split_part(su.email, '@', 1)
            ELSE su.first_name
          END,
          su.last_name
        )), ''), 'Пользователь')
      END AS sender_name
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN trainer_profiles p ON p.id = c.trainer_profile_id
    LEFT JOIN users su ON su.id = m.sender_id
    LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${userId}::uuid
    WHERE m.deleted_at IS NULL
      AND m.sender_id <> ${userId}::uuid
      AND (r.last_read_message_id IS NULL OR m.id > r.last_read_message_id)
      AND (
        c.user_id = ${userId}::uuid
        OR (
          (p.owner_user_id = ${userId}::uuid OR c.host_user_id = ${userId}::uuid)
          AND c.user_id <> ${userId}::uuid
        )
      )
    ORDER BY m.id DESC
    LIMIT 1
  `);
  const notice = fresh?.conversation_id
    ? {
        conversationId: fresh.conversation_id,
        messageId: asNumber(fresh.message_id),
        name: (fresh.sender_name ?? "").trim() || "Пользователь",
      }
    : null;
  return { own, inbox, total: own + inbox, ownedSlugs: owned, notice };
}
