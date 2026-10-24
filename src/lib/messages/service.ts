import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { consumeRateLimit } from "@/auth/rate-limit";
import { getDb } from "@/db";
import {
  blockedPairs,
  conversationReads,
  conversations,
  messageReports,
  messages,
  trainerProfiles,
  users,
  type Conversation,
} from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { reviewPlainText, reviewTextLength, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { scheduleMessageNotification } from "@/lib/messages/notify";
import {
  CONVERSATION_PAGE_SIZE,
  DAILY_TRAINER_LIMIT_MESSAGE,
  DAILY_TRAINER_MESSAGE_LIMIT,
  FIRST_MESSAGE_MAX_LENGTH,
  MESSAGE_HTML_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  type ConversationCursor,
  type ConversationListResult,
  type CounterpartDto,
  type MessageCursor,
  type MessageDto,
  type MessagingSummary,
  type ReportRow,
  type ThreadResult,
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
  if (input.ownerUserId && input.actorId === input.ownerUserId) {
    return { ok: false, message: "Нельзя написать своему профилю." };
  }
  if (!input.published) return { ok: false, message: "Этот профиль пока не принимает сообщения." };
  if (input.blocked) return { ok: false, message: "Переписка с этим профилем недоступна." };
  return { ok: true };
}

export function getCounterparty(input: {
  viewerId: string;
  conversationUserId: string;
  userName: string;
  userFirstName: string;
  userLastName: string;
  userAvatarPath: string;
  trainerName: string;
  trainerFirstName: string;
  trainerLastName: string;
  trainerAvatarPath: string;
  trainerSlug: string;
}): CounterpartDto {
  if (input.viewerId === input.conversationUserId) {
    return {
      name: input.trainerName,
      firstName: input.trainerFirstName,
      lastName: input.trainerLastName,
      avatarPath: input.trainerAvatarPath,
      slug: input.trainerSlug,
      kind: "trainer",
    };
  }
  return {
    name: input.userName,
    firstName: input.userFirstName,
    lastName: input.userLastName,
    avatarPath: input.userAvatarPath,
    slug: null,
    kind: "user",
  };
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

function personName(firstName: string, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";
}

function trainerLabel(fullName: string, firstName: string, lastName: string) {
  return fullName.trim() || personName(firstName, lastName) || "Тренер";
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

function assertSendRate(userId: string) {
  const minute = consumeRateLimit(`msg:min:${userId}`, 60_000, 10);
  if (!minute.ok) {
    throw new AuthError(`Слишком много сообщений. Подождите ${minute.retryAfterSec} с.`, "RATE_LIMITED");
  }
  const day = consumeRateLimit(`msg:day:${userId}`, 24 * 60 * 60_000, 300);
  if (!day.ok) throw new AuthError("Достигнут дневной лимит сообщений. Попробуйте завтра.", "RATE_LIMITED");
}

/** Messages this user already sent today, as the client of the thread. Replies from a profile owner are not counted. */
async function assertDailyTrainerOutreach(userId: string, trainerProfileId: string) {
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

async function loadConversation(conversationId: string) {
  const [conversation] = await getDb().select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return null;
  const [profile] = await getDb()
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
    .where(eq(trainerProfiles.id, conversation.trainerProfileId))
    .limit(1);
  if (!profile) return null;
  const blocked = await isBlocked(conversation.userId, conversation.trainerProfileId);
  return { conversation, profile, access: accessFrom(conversation, profile, blocked) };
}

async function requireConversation(actor: MessageActor, conversationId: string, mode: AccessMode) {
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

export async function ensureConversation(actor: MessageActor, trainerProfileSlug: string) {
  const profile = await profileBySlug(trainerProfileSlug);
  if (!profile) throw new AuthError("Профиль не найден.", "VALIDATION");
  const conversation = await openOrCreate(actor.id, profile);
  return { conversationId: conversation.id };
}

async function toMessageDto(row: {
  id: number | string;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
}, actor: MessageActor, staffSeesBody: boolean, readUpTo: number | null): Promise<MessageDto> {
  const deleted = row.deletedAt != null;
  const id = asNumber(row.id);
  const mine = row.senderId === actor.id;
  return {
    id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: deleted && !staffSeesBody ? "" : row.body,
    clientId: row.clientId,
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    deleted,
    mine,
    receipt: !mine || deleted ? null : readUpTo != null && id <= readUpTo ? "read" : "delivered",
  };
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

export async function sendMessage(
  actor: MessageActor,
  input: { conversationId?: string; trainerProfileSlug?: string; body: string; clientId: string },
) {
  let conversationId = input.conversationId;
  if (!conversationId) {
    if (!input.trainerProfileSlug) throw new AuthError("Не указана переписка.", "VALIDATION");
    conversationId = (await ensureConversation(actor, input.trainerProfileSlug)).conversationId;
  }
  const loaded = await requireConversation(actor, conversationId, "write");
  const html = sanitizeReviewHtml(input.body);
  const plain = reviewPlainText(html);
  if (!plain) throw new AuthError("Введите сообщение.", "VALIDATION");
  if (html.length > MESSAGE_HTML_MAX_LENGTH) throw new AuthError("Сообщение слишком длинное.", "VALIDATION");
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
  if (reviewTextLength(html) > limit) {
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
    if (!duplicate) await assertDailyTrainerOutreach(actor.id, loaded.conversation.trainerProfileId);
  }
  assertSendRate(actor.id);
  const saved = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId: actor.id,
        body: html,
        clientId: input.clientId,
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

  return {
    message: await toMessageDto(saved.row, actor, false, null),
    duplicate: saved.duplicate,
  };
}

const activityAt = sql<Date>`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;

export async function listConversations(
  actor: MessageActor,
  input: { view: "own" | "inbox"; cursor?: ConversationCursor },
): Promise<ConversationListResult> {
  if (input.view === "inbox" && !actor.roles.some((role) => role === "trainer" || role === "club" || role === "admin" || role === "superadmin")) {
    throw new AuthError("Нет доступа к перепискам профиля.", "FORBIDDEN");
  }
  const filters = [
    input.view === "own"
      ? eq(conversations.userId, actor.id)
      : eq(trainerProfiles.ownerUserId, actor.id),
  ];
  if (input.cursor) {
    const at = new Date(input.cursor.at);
    if (Number.isNaN(at.getTime())) throw new AuthError("Некорректная страница.", "VALIDATION");
    filters.push(sql`(${activityAt}, ${conversations.id}) < (${at.toISOString()}::timestamptz, ${input.cursor.id}::uuid)`);
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
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatar: users.avatarPath,
    })
    .from(conversations)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .innerJoin(users, eq(users.id, conversations.userId))
    .where(and(...filters))
    .orderBy(desc(activityAt), desc(conversations.id))
    .limit(CONVERSATION_PAGE_SIZE + 1);

  const hasMore = rows.length > CONVERSATION_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CONVERSATION_PAGE_SIZE) : rows;
  const ids = page.map((row) => row.id);
  const previews = new Map<string, string>();
  const unread = new Map<string, number>();
  if (ids.length > 0) {
    const previewRows = await getDb().execute<{ conversationId: string; body: string }>(sql`
      SELECT DISTINCT ON (conversation_id)
        conversation_id AS "conversationId",
        body
      FROM messages
      WHERE conversation_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
        AND deleted_at IS NULL
      ORDER BY conversation_id, created_at DESC, id DESC
    `);
    for (const row of previewRows) previews.set(row.conversationId, messagePreview(row.body));

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

  const items = page.map((row) => {
    const activity = iso(row.activityAt) ?? new Date(0).toISOString();
    return {
      id: row.id,
      status: row.status,
      activityAt: activity,
      preview: previews.get(row.id) ?? "",
      unread: unread.get(row.id) ?? 0,
      trainerSlug: row.trainerSlug,
      counterpart: getCounterparty({
        viewerId: actor.id,
        conversationUserId: row.userId,
        userName: personName(row.userFirstName, row.userLastName),
        userFirstName: row.userFirstName,
        userLastName: row.userLastName ?? "",
        userAvatarPath: row.userAvatar,
        trainerName: trainerLabel(row.trainerFullName, row.trainerFirstName, row.trainerLastName),
        trainerFirstName: row.trainerFirstName,
        trainerLastName: row.trainerLastName,
        trainerAvatarPath: row.trainerAvatar,
        trainerSlug: row.trainerSlug,
      }),
    };
  });
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { at: last.activityAt, id: last.id } : null,
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
    .select({ firstName: users.firstName, lastName: users.lastName, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, loaded.conversation.userId))
    .limit(1);
  const oldest = page[page.length - 1];
  const readUpTo = await counterpartReadUpTo(actor, loaded.conversation, loaded.profile.ownerUserId);
  return {
    conversationId: loaded.conversation.id,
    status: loaded.conversation.status,
    trainerName: trainerLabel(loaded.profile.fullName, loaded.profile.firstName, loaded.profile.lastName),
    trainerSlug: loaded.profile.slug,
    counterpart: getCounterparty({
      viewerId: actor.id,
      conversationUserId: loaded.conversation.userId,
      userName: personName(user?.firstName ?? "", user?.lastName),
      userFirstName: user?.firstName ?? "",
      userLastName: user?.lastName ?? "",
      userAvatarPath: user?.avatarPath ?? "",
      trainerName: trainerLabel(loaded.profile.fullName, loaded.profile.firstName, loaded.profile.lastName),
      trainerFirstName: loaded.profile.firstName,
      trainerLastName: loaded.profile.lastName,
      trainerAvatarPath: loaded.profile.avatarPath,
      trainerSlug: loaded.profile.slug,
    }),
    canWrite,
    canClose: allows(actor, loaded.access, "close"),
    canReopen: allows(actor, loaded.access, "reopen"),
    canBlock: allows(actor, loaded.access, "block"),
    canHide: false,
    canReport: isParticipant(actor.id, loaded.access) || staff,
    composeLimit,
    messages: await Promise.all(page.map((row) => toMessageDto(row, actor, staff, readUpTo))),
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

export async function reportMessage(actor: MessageActor, input: { messageId: number; reason: string }) {
  const [message] = await getDb()
    .select({ id: messages.id, conversationId: messages.conversationId, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, input.messageId))
    .limit(1);
  if (!message) throw new AuthError("Сообщение не найдено.", "VALIDATION");
  if (message.senderId === actor.id) throw new AuthError("Нельзя жаловаться на своё сообщение.", "VALIDATION");
  await requireConversation(actor, message.conversationId, "read");
  if (!isParticipant(actor.id, (await loadConversation(message.conversationId))!.access) && !isStaff(actor.roles)) {
    throw new AuthError("Нет доступа к этой переписке.", "FORBIDDEN");
  }
  try {
    await getDb().insert(messageReports).values({
      messageId: message.id,
      reporterId: actor.id,
      reason: input.reason,
      status: "new",
    });
    return { ok: true as const, duplicate: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: true as const, duplicate: true };
  }
}

export async function listReports(actor: MessageActor): Promise<ReportRow[]> {
  if (!isStaff(actor.roles)) throw new AuthError("Недостаточно прав.", "FORBIDDEN");
  const rows = await getDb()
    .select({
      id: messageReports.id,
      status: messageReports.status,
      reason: messageReports.reason,
      createdAt: messageReports.createdAt,
      messageId: messageReports.messageId,
      body: messages.body,
      conversationId: conversations.id,
      conversationStatus: conversations.status,
      reporterId: messageReports.reporterId,
      reporterFirstName: users.firstName,
      reporterLastName: users.lastName,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      trainerSlug: trainerProfiles.slug,
    })
    .from(messageReports)
    .innerJoin(messages, eq(messages.id, messageReports.messageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .innerJoin(users, eq(users.id, messageReports.reporterId))
    .orderBy(desc(messageReports.createdAt));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    reason: row.reason,
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    messageId: asNumber(row.messageId),
    preview: messagePreview(row.body),
    conversationId: row.conversationId,
    conversationStatus: row.conversationStatus,
    reporterId: row.reporterId,
    reporterName: personName(row.reporterFirstName, row.reporterLastName),
    trainerName: trainerLabel(row.trainerFullName, row.trainerFirstName, row.trainerLastName),
    trainerSlug: row.trainerSlug,
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
  const ids = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));
  if (ids.length === 0) return;
  await getDb()
    .update(messageReports)
    .set({ status: "reviewed" })
    .where(and(eq(messageReports.status, "new"), inArray(messageReports.messageId, ids.map((row) => row.id))));
}

export async function blockPair(actor: MessageActor, conversationId: string) {
  const loaded = await requireConversation(actor, conversationId, "block");
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
        INNER JOIN trainer_profiles p ON p.id = c.trainer_profile_id
        LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${userId}::uuid
        WHERE p.owner_user_id = ${userId}::uuid
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
  return { own, inbox, total: own + inbox, ownedSlugs: owned };
}
