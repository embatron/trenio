import { createFileRoute } from "@tanstack/react-router";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit } from "@/auth/rate-limit";
import { applySyncMarks, listSyncMarks } from "@/lib/sync/apply-marks";
import { syncAuthorized } from "@/lib/sync/policy";
import type { MarkPush } from "@/lib/sync/remote";
import { writeLog } from "@/lib/log/logger";

function denied() {
  void writeLog({
    level: "warn",
    domain: "admin",
    action: "admin.sync_marks",
    outcome: "denied",
    message: "Синхронизация отметок отклонена.",
  });
  return Response.json({ ok: false }, { status: 401, headers: { "cache-control": "private, no-store" } });
}

async function limited(request: Request) {
  const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
  const limit = await consumeRateLimit(`sync:ip:${ip}`, 60_000, 60);
  if (limit.ok) return null;
  return Response.json({ ok: false }, {
    status: 429,
    headers: { "cache-control": "private, no-store", "retry-after": String(limit.retryAfterSec) },
  });
}

export const Route = createFileRoute("/api/sync/marks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) return denied();
        const busy = await limited(request);
        if (busy) return busy;
        const trainers = await listSyncMarks();
        return Response.json({ ok: true, trainers }, { headers: { "cache-control": "private, no-store" } });
      },
      POST: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) return denied();
        const busy = await limited(request);
        if (busy) return busy;
        const body = await request.json().catch(() => null) as { marks?: MarkPush[] } | null;
        if (!body || !Array.isArray(body.marks)) {
          return Response.json({ ok: false }, { status: 400, headers: { "cache-control": "private, no-store" } });
        }
        const result = await applySyncMarks(body.marks);
        return Response.json({ ok: true, ...result }, { headers: { "cache-control": "private, no-store" } });
      },
    },
  },
});
