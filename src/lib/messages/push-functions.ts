import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";
import { ensurePushSchema } from "@/lib/messages/push-schema";
import { pushPublicKey } from "@/lib/messages/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().trim().min(1).max(255),
  auth: z.string().trim().min(1).max(255),
});

export const getPushPublicKeyFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensurePushSchema();
  return { publicKey: pushPublicKey() };
});

export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(subscriptionSchema)
  .handler(async ({ data, context }) => {
    await ensurePushSchema();
    const db = getDb();
    const [person] = await db
      .select({ pushMessages: users.pushMessages })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    if (!person?.pushMessages) return { ok: true as const };
    await db
      .insert(pushSubscriptions)
      .values({
        userId: context.user.id,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: context.user.id, p256dh: data.p256dh, auth: data.auth },
      });
    return { ok: true as const };
  });

export const dropPushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ endpoint: z.string().url().max(2000) }))
  .handler(async ({ data, context }) => {
    await ensurePushSchema();
    await getDb()
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, data.endpoint), eq(pushSubscriptions.userId, context.user.id)));
    return { ok: true as const };
  });

/** Cabinet switch. On by default. Off deletes every phone subscription for this account. */
export const setPushMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    await ensurePushSchema();
    const db = getDb();
    await db
      .update(users)
      .set({ pushMessages: data.enabled, updatedAt: new Date() })
      .where(eq(users.id, context.user.id));
    if (!data.enabled) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, context.user.id));
    }
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.push",
      outcome: "success",
      message: data.enabled ? "Уведомления на телефон включены." : "Уведомления на телефон выключены.",
      subject: context.user.email,
      actorUserId: context.user.id,
      context: { enabled: data.enabled },
    });
    return { ok: true as const };
  });
