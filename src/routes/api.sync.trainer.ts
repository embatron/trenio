import { createFileRoute } from "@tanstack/react-router";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit } from "@/auth/rate-limit";
import type { DraftFile } from "@/db/import-draft-map";
import { applyTrainerPatch, listTrainerSyncHeads, parseTrainerPatch, readTrainerSync } from "@/lib/sync/apply-card";
import { applySyncedTrainer } from "@/lib/sync/apply-trainer";
import { syncAuthorized } from "@/lib/sync/policy";
import { writeLog } from "@/lib/log/logger";

const PRIVATE = { "cache-control": "private, no-store" };

function denied(action: "admin.sync_trainer" | "admin.sync_trainers", message: string) {
  void writeLog({ level: "warn", domain: "admin", action, outcome: "denied", message });
  return Response.json({ ok: false }, { status: 401, headers: PRIVATE });
}

async function limited(request: Request, bucket: string, max: number) {
  const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
  const limit = await consumeRateLimit(`sync:${bucket}:${ip}`, 60_000, max);
  if (limit.ok) return null;
  return Response.json({ ok: false }, {
    status: 429,
    headers: { ...PRIVATE, "retry-after": String(limit.retryAfterSec) },
  });
}

export const Route = createFileRoute("/api/sync/trainer")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) {
          return denied("admin.sync_trainers", "Синхронизация карточек отклонена.");
        }
        const handle = new URL(request.url).searchParams.get("handle")?.trim() || "";
        const busy = await limited(request, handle ? "trainer" : "trainers", handle ? 30 : 60);
        if (busy) return busy;
        if (!handle) {
          const trainers = await listTrainerSyncHeads();
          return Response.json({ ok: true, trainers }, { headers: PRIVATE });
        }
        const found = await readTrainerSync(handle);
        if (!found) return Response.json({ ok: false }, { status: 404, headers: PRIVATE });
        return Response.json({ ok: true, ...found }, { headers: PRIVATE });
      },
      POST: async ({ request }) => {
        if (!syncAuthorized(request.headers.get("authorization"))) {
          return denied("admin.sync_trainer", "Синхронизация черновика отклонена.");
        }
        const busy = await limited(request, "trainer", 30);
        if (busy) return busy;
        const body = await request.json().catch(() => null) as {
          draft?: DraftFile;
          patch?: unknown;
          files?: Array<{ name?: unknown; data?: unknown }>;
        } | null;
        if (body?.patch) {
          const patch = parseTrainerPatch(body.patch);
          if (!patch) return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
          const saved = await applyTrainerPatch(patch, body.files ?? [], "existing");
          if (!saved.ok) return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
          return Response.json({ ok: true, handle: patch.handle, ...saved }, { headers: PRIVATE });
        }
        if (!body?.draft) return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
        const saved = await applySyncedTrainer(body);
        if (!saved.ok) return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
        return Response.json(
          { ok: true, handle: saved.handle, created: saved.created },
          { headers: PRIVATE },
        );
      },
    },
  },
});
