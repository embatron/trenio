import { randomUUID } from "node:crypto";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { conversations, messageAttachments, messageReports, messages, trainerProfiles, userRoles, users } from "@/db/schema";
import { isGodUser } from "@/lib/auth/god";
import { SITE_EMAIL } from "@/lib/seo/site";
import { logCaught, writeLog } from "@/lib/log/logger";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { scheduleMessageNotification } from "@/lib/messages/notify";
import { planTrainerWelcome, shouldSendPublishWelcome, type WelcomePairThread } from "@/lib/messages/welcome-publish";
import { renderTrainerWelcome } from "@/lib/site-texts/defaults";
import { loadSiteText } from "@/lib/site-texts/store";

export { PORTAL_TELEGRAM_URL } from "@/lib/site-texts/defaults";

/** Warm first letter from the portal admin. Stored as the same HTML the composer keeps. */
export function trainerWelcomeHtml(firstName: string, template?: string) {
  return renderTrainerWelcome(firstName, template);
}

async function portalAdmin() {
  const [admin] = await getDb()
    .select({ id: users.id, firstName: users.firstName })
    .from(users)
    .where(eq(users.email, SITE_EMAIL))
    .limit(1);
  return admin ?? null;
}

async function deliverTrainerWelcome(user: { id: string; firstName: string }) {
  const admin = await portalAdmin();
  if (!admin) {
    void writeLog({
      level: "warn",
      domain: "message",
      action: "message.welcome",
      outcome: "skipped",
      message: "Админ портала не найден. Приветствие не отправлено.",
      actorUserId: user.id,
    });
    return;
  }
  if (admin.id === user.id || isGodUser(user.id)) return;
  const roles = await getDb()
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  if (roles.some((item) => item.role === "admin" || item.role === "superadmin")) return;
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      hostUserId: conversations.hostUserId,
    })
    .from(conversations)
    .leftJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .where(and(
      eq(conversations.status, "open"),
      or(
        and(
          eq(conversations.userId, user.id),
          or(eq(conversations.hostUserId, admin.id), eq(trainerProfiles.ownerUserId, admin.id)),
        ),
        and(
          eq(conversations.userId, admin.id),
          or(eq(conversations.hostUserId, user.id), eq(trainerProfiles.ownerUserId, user.id)),
        ),
      ),
    ));
  const ids = rows.map((row) => row.id);
  const messageCounts = new Map<string, number>();
  if (ids.length > 0) {
    const counted = await db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .groupBy(messages.conversationId);
    for (const row of counted) messageCounts.set(row.conversationId, Number(row.count));
    const attached = await db
      .select({ conversationId: messageAttachments.conversationId })
      .from(messageAttachments)
      .where(inArray(messageAttachments.conversationId, ids));
    for (const row of attached) {
      messageCounts.set(row.conversationId, (messageCounts.get(row.conversationId) ?? 0) + 1);
    }
  }
  const threads: WelcomePairThread[] = rows.map((row) => ({
    id: row.id,
    portal: row.userId === user.id && row.hostUserId === admin.id,
    messages: messageCounts.get(row.id) ?? 0,
  }));
  const plan = planTrainerWelcome(threads);
  if (plan.dropIds.length > 0) {
    const [files, reports] = await Promise.all([
      db.select({ conversationId: messageAttachments.conversationId }).from(messageAttachments).where(inArray(messageAttachments.conversationId, plan.dropIds)),
      db.select({ conversationId: messageReports.conversationId }).from(messageReports).where(inArray(messageReports.conversationId, plan.dropIds)),
    ]);
    const busy = new Set([...files, ...reports].map((row) => row.conversationId));
    const safe = plan.dropIds.filter((id) => !busy.has(id));
    if (safe.length > 0) {
      await db.delete(conversations).where(inArray(conversations.id, safe));
    }
  }
  if (!plan.create && !plan.conversationId) return;

  const body = trainerWelcomeHtml(user.firstName, await loadSiteText("trainer_welcome"));
  if (reviewTextLength(body) > 4000) {
    void writeLog({
      level: "error",
      domain: "message",
      action: "message.welcome",
      outcome: "failure",
      message: "Приветствие длиннее лимита сообщения.",
      actorUserId: user.id,
    });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    let conversationId = plan.conversationId;
    if (!conversationId) {
      const [conversation] = await tx.insert(conversations).values({
        userId: user.id,
        hostUserId: admin.id,
        status: "open",
      }).returning();
      if (!conversation) return null;
      conversationId = conversation.id;
    }
    const [message] = await tx.insert(messages).values({
      conversationId,
      senderId: admin.id,
      body,
      clientId: randomUUID(),
    }).returning({ id: messages.id, createdAt: messages.createdAt });
    if (!message) return null;
    await tx.update(conversations).set({ lastMessageAt: message.createdAt }).where(eq(conversations.id, conversationId));
    return { conversationId, messageId: message.id };
  });
  if (!saved) return;
  scheduleMessageNotification({
    conversationId: saved.conversationId,
    messageId: Number(saved.messageId),
    recipientId: user.id,
  });
  void writeLog({
    level: "info",
    domain: "message",
    action: "message.welcome",
    outcome: "success",
    message: "Приветствие тренеру отправлено.",
    actorUserId: admin.id,
    target: saved.conversationId,
    context: { chars: reviewTextLength(body) },
  });
}

/** One welcome thread from the admin account Trenioby. A later call does not send a second letter. Failures stay out of publish. */
export async function sendTrainerWelcome(user: { id: string; firstName: string }) {
  try {
    await deliverTrainerWelcome(user);
  } catch (error) {
    logCaught("message", "message.welcome", error, { actorUserId: user.id });
  }
}

/** The first time a confirmed owner is in the catalog. A hide and a later publish do not send again. */
export async function sendWelcomeOnPublish(input: {
  previous: string | null;
  next: string;
  ownerUserId: string | null;
  firstName: string;
  confirmed: boolean;
  ownerAttached?: boolean;
}) {
  if (!shouldSendPublishWelcome({
    previous: input.previous,
    next: input.next,
    hasOwner: Boolean(input.ownerUserId),
    confirmed: input.confirmed,
    ownerAttached: input.ownerAttached,
  }) || !input.ownerUserId) return;
  await sendTrainerWelcome({
    id: input.ownerUserId,
    firstName: input.firstName.trim() || "Тренер",
  });
}
