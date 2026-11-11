import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { siteTexts } from "@/db/schema";
import { logCaught } from "@/lib/log/logger";
import { resolvedSiteText, SITE_TEXT_KEYS, type SiteTextKey } from "@/lib/site-texts/defaults";

let missingTableLogged = false;

function isSiteTextKey(value: string): value is SiteTextKey {
  return (SITE_TEXT_KEYS as readonly string[]).includes(value);
}

/** Saved text, or the copy that ships with the site when the row or the table is missing. */
export async function loadSiteText(key: SiteTextKey): Promise<string> {
  try {
    const [row] = await getDb()
      .select({ body: siteTexts.body })
      .from(siteTexts)
      .where(eq(siteTexts.key, key))
      .limit(1);
    return resolvedSiteText(key, row?.body);
  } catch (error) {
    if (!missingTableLogged) {
      missingTableLogged = true;
      logCaught("admin", "admin.site_text", error, { target: key });
    }
    return resolvedSiteText(key);
  }
}

export async function loadSiteTexts(): Promise<Record<SiteTextKey, string>> {
  const entries = await Promise.all(SITE_TEXT_KEYS.map(async (key) => [key, await loadSiteText(key)] as const));
  return Object.fromEntries(entries) as Record<SiteTextKey, string>;
}

export async function saveSiteTexts(actorUserId: string, bodies: Record<SiteTextKey, string>) {
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const key of SITE_TEXT_KEYS) {
      const body = bodies[key];
      if (!isSiteTextKey(key)) continue;
      await tx
        .insert(siteTexts)
        .values({ key, body, updatedAt: now, updatedBy: actorUserId })
        .onConflictDoUpdate({
          target: siteTexts.key,
          set: { body, updatedAt: now, updatedBy: actorUserId },
        });
    }
  });
}
