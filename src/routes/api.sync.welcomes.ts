import { createFileRoute } from "@tanstack/react-router";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit } from "@/auth/rate-limit";
import { writeLog } from "@/lib/log/logger";
import { listSyncWelcomes } from "@/lib/sync/apply-welcomes";
import { syncAuthorized } from "@/lib/sync/policy";

const PRIVATE = { "cache-control": "private, no-store" };

function denied() {
  void writeLog({
    level: "warn",
    domain: "admin",
    action: "admin.sync_welcomes",
    outcome: "denied",
    message: "Синхронизация заявок отклонена.",
  });
  return Response.json({ ok: false }, { status: 401, headers: PRIVATE });
}

export const Route = createFileRoute("/api/sync/welcomes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) return denied();
        const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
        const limit = await consumeRateLimit(`sync:welcomes:${ip}`, 60_000, 60);
        if (!limit.ok) {
          return Response.json(
            { ok: false },
            {
              status: 429,
              headers: { ...PRIVATE, "retry-after": String(limit.retryAfterSec) },
            },
          );
        }
        const welcomes = await listSyncWelcomes();
        return Response.json({ ok: true, welcomes }, { headers: PRIVATE });
      },
    },
  },
});
