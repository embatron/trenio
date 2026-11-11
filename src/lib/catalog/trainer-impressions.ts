import { createServerFn } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { getDb } from "@/db";
import { trainerCardImpressions, trainerProfiles } from "@/db/schema";
import { ensureTrainerImpressionTable } from "@/lib/catalog/trainer-impression-store";
import { minskToday } from "@/lib/catalog/trainer-periods";
import { visitorId } from "@/lib/catalog/trainer-visitor";
import { logCaught } from "@/lib/log/logger";
import { publishCabinet } from "@/lib/messages/live-hub";

const slugSchema = z.string().trim().regex(/^[a-z0-9._-]{1,30}$/);

/** One catalog impression per browser per Minsk day. The profile owner is not counted. */
export const recordTrainerCardImpressionsFn = createServerFn({ method: "POST" })
  .validator(z.object({ slugs: z.array(slugSchema).max(80) }))
  .handler(async ({ data }) => {
    const slugs = [...new Set(data.slugs)];
    if (slugs.length === 0) return { ok: true as const };
    if (!(await ensureTrainerImpressionTable())) return { ok: true as const };

    try {
      const db = getDb();
      const profiles = await db
        .select({
          id: trainerProfiles.id,
          ownerUserId: trainerProfiles.ownerUserId,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(inArray(trainerProfiles.slug, slugs));
      const session = await getSessionUserFromToken(readSessionToken());
      const visible = profiles.filter((profile) => profile.status === "published" && !(session && profile.ownerUserId && session.id === profile.ownerUserId));
      if (visible.length === 0) return { ok: true as const };

      const visitor = visitorId();
      const day = minskToday();
      await db
        .insert(trainerCardImpressions)
        .values(visible.map((profile) => ({ profileId: profile.id, visitorId: visitor, day })))
        .onConflictDoNothing();
      publishCabinet(visible.map((profile) => profile.ownerUserId));
      return { ok: true as const };
    } catch (error) {
      logCaught("catalog", "catalog.impression", error);
      return { ok: true as const };
    }
  });
