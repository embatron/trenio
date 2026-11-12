import { and, eq, inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { logCaught } from "@/lib/log/logger";
import { presenceFor } from "@/lib/messages/presence";
import type { Presence } from "@/lib/messages/schemas";

const slugsSchema = z.object({
  slugs: z.array(z.string().trim().regex(/^[a-z0-9._-]{1,80}$/)).max(80),
});

/** Presence of the published card's owner. A card without an owner is offline. */
export const trainerPresenceFn = createServerFn({ method: "POST" })
  .validator(slugsSchema)
  .handler(async ({ data }): Promise<Record<string, Presence>> => {
    const slugs = [...new Set(data.slugs)];
    const offline = Object.fromEntries(slugs.map((slug) => [slug, "offline" as const]));
    if (slugs.length === 0) return offline;
    try {
      const rows = await getDb()
        .select({ slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId })
        .from(trainerProfiles)
        .where(and(eq(trainerProfiles.status, "published"), inArray(trainerProfiles.slug, slugs)));
      const owners = rows.flatMap((row) => (row.ownerUserId ? [row.ownerUserId] : []));
      const states = await presenceFor(owners);
      for (const row of rows) {
        offline[row.slug] = row.ownerUserId ? states.get(row.ownerUserId) ?? "offline" : "offline";
      }
      return offline;
    } catch (error) {
      logCaught("catalog", "catalog.presence", error);
      return offline;
    }
  });
