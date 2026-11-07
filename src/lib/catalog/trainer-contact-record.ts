import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import {
  CONTACT_CLICK_KINDS,
  contactClickIsRepeat,
  ensureTrainerContactClickTable,
  insertContactClick,
  latestContactClickAt,
} from "@/lib/catalog/trainer-contact-clicks";
import { minskToday } from "@/lib/catalog/trainer-periods";
import { visitorId } from "@/lib/catalog/trainer-visitor";
import { logCaught } from "@/lib/log/logger";

/** One click on the public phone, Instagram, or Telegram. The owner is not stored. */
export const recordTrainerContactClickFn = createServerFn({ method: "POST" })
  .validator(z.object({
    slug: z.string().trim().min(1).max(40),
    kind: z.enum(CONTACT_CLICK_KINDS),
  }))
  .handler(async ({ data }) => {
    if (!(await ensureTrainerContactClickTable())) return { ok: true as const };
    try {
      const db = getDb();
      const [profile] = await db
        .select({
          id: trainerProfiles.id,
          ownerUserId: trainerProfiles.ownerUserId,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, data.slug))
        .limit(1);
      if (!profile || profile.status !== "published") return { ok: true as const };

      const session = await getSessionUserFromToken(readSessionToken());
      if (session && profile.ownerUserId && session.id === profile.ownerUserId) return { ok: true as const };

      const visitor = visitorId();
      const previous = await latestContactClickAt(profile.id, visitor, data.kind);
      if (contactClickIsRepeat(previous, Date.now())) return { ok: true as const };

      await insertContactClick({
        profileId: profile.id,
        visitorId: visitor,
        kind: data.kind,
        day: minskToday(),
      });
      return { ok: true as const };
    } catch (error) {
      logCaught("catalog", "catalog.contact", error, { target: data.slug });
      return { ok: true as const };
    }
  });
