import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
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
    await getDb()
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
