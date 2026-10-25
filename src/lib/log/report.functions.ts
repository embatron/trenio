import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { optionalAuthMiddleware } from "@/auth/middleware";
import { consumeRateLimit } from "@/auth/rate-limit";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { acceptClientEvent, clientLogBatchSchema } from "@/lib/log/client-schema";
import { writeLog } from "@/lib/log/logger";

export const reportClientLogsFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(clientLogBatchSchema)
  .handler(async ({ data, context }) => {
    const request = getRequest();
    const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
    const limit = consumeRateLimit(`client-log:${ip}`, 5 * 60_000, 20);
    if (!limit.ok) return { ok: true as const };

    for (const event of data.events) {
      if (!acceptClientEvent(event)) continue;
      await writeLog({
        level: event.level,
        domain: event.domain,
        action: event.action,
        outcome: "failure",
        message: event.message,
        actorUserId: context.user?.id ?? null,
        subject: context.user?.email ?? null,
        route: event.route,
        statusCode: event.statusCode,
        durationMs: event.durationMs,
        requestId: event.requestId,
        context: { source: "client" },
      });
    }
    return { ok: true as const };
  });
