import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { conversations, messages, userRoles, users } from "@/db/schema";
import { isGodUser } from "@/lib/auth/god";
import { SITE_EMAIL } from "@/lib/seo/site";
import { logCaught, writeLog } from "@/lib/log/logger";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { scheduleMessageNotification } from "@/lib/messages/notify";
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
  const [open] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.userId, user.id),
      eq(conversations.hostUserId, admin.id),
      eq(conversations.status, "open"),
    ))
    .limit(1);
  if (open) return;

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
    const [conversation] = await tx.insert(conversations).values({
      userId: user.id,
      hostUserId: admin.id,
      status: "open",
    }).returning();
    if (!conversation) return null;
    const [message] = await tx.insert(messages).values({
      conversationId: conversation.id,
      senderId: admin.id,
      body,
      clientId: randomUUID(),
    }).returning({ id: messages.id, createdAt: messages.createdAt });
    if (!message) return null;
    await tx.update(conversations).set({ lastMessageAt: message.createdAt }).where(eq(conversations.id, conversation.id));
    return { conversationId: conversation.id, messageId: message.id };
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

/** One welcome thread from the admin account Trenioby. A later call does not send a second letter. Failures stay out of signup. */
export async function sendTrainerWelcome(user: { id: string; firstName: string }) {
  try {
    await deliverTrainerWelcome(user);
  } catch (error) {
    logCaught("message", "message.welcome", error, { actorUserId: user.id });
  }
}
