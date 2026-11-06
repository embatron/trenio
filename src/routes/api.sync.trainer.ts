import { createFileRoute } from "@tanstack/react-router";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit } from "@/auth/rate-limit";
import type { DraftFile } from "@/db/import-draft-map";
import { applySyncedTrainer } from "@/lib/sync/apply-trainer";
import { syncAuthorized } from "@/lib/sync/policy";
import { writeLog } from "@/lib/log/logger";

export const Route = createFileRoute("/api/sync/trainer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) {
          void writeLog({
            level: "warn",
            domain: "admin",
            action: "admin.sync_trainer",
            outcome: "denied",
            message: "Синхронизация черновика отклонена.",
          });
          return Response.json({ ok: false }, { status: 401, headers: { "cache-control": "private, no-store" } });
        }
        const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
        const limit = await consumeRateLimit(`sync:ip:${ip}`, 60_000, 30);
        if (!limit.ok) {
          return Response.json({ ok: false }, {
            status: 429,
            headers: { "cache-control": "private, no-store", "retry-after": String(limit.retryAfterSec) },
          });
        }
        const body = await request.json().catch(() => null) as { draft?: DraftFile; files?: Array<{ name?: unknown; data?: unknown }> } | null;
        if (!body?.draft) {
          return Response.json({ ok: false }, { status: 400, headers: { "cache-control": "private, no-store" } });
        }
        const saved = await applySyncedTrainer(body);
        if (!saved.ok) {
          return Response.json({ ok: false }, { status: 400, headers: { "cache-control": "private, no-store" } });
        }
        return Response.json(
          { ok: true, handle: saved.handle, created: saved.created },
          { headers: { "cache-control": "private, no-store" } },
        );
      },
    },
  },
});
