import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { buildCatalogPulse, emptyCatalogPulse, type CatalogPulse } from "@/lib/admin/catalog-pulse";
import { ensureTrainerPublishedAt } from "@/lib/catalog/trainer-published";
import { logCaught } from "@/lib/log/logger";

function sportLabel(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      return sportLabel(JSON.parse(value));
    } catch {
      return "";
    }
  }
  if (typeof value === "object" && "label" in value) {
    const label = (value as { label?: unknown }).label;
    return typeof label === "string" ? label.trim() : "";
  }
  return "";
}

function flag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** Reads every card once. A failure keeps the rest of the overview. */
export async function loadCatalogPulse(today: string): Promise<CatalogPulse> {
  try {
    await ensureTrainerPublishedAt();
    const rows = await getDb().execute(sql`
      SELECT
        slug,
        instagram_handle,
        status,
        city,
        created_at,
        published_at,
        outreach_sent_at,
        invite_sent_at,
        door_entered_at,
        owner_user_id,
        verified,
        avatar_path,
        price_from,
        phone,
        primary_sport
      FROM trainer_profiles
    `);
    return buildCatalogPulse(rows.map((row) => ({
      slug: text(row.slug),
      handle: text(row.instagram_handle),
      status: text(row.status),
      city: text(row.city),
      createdAt: (row.created_at as Date | string | null) ?? null,
      publishedAt: (row.published_at as Date | string | null) ?? null,
      outreach: row.outreach_sent_at != null,
      invite: row.invite_sent_at != null,
      door: row.door_entered_at != null,
      owned: row.owner_user_id != null,
      verified: flag(row.verified),
      hasPhoto: text(row.avatar_path).trim().length > 0,
      hasPrice: row.price_from != null && Number(row.price_from) > 0,
      hasPhone: text(row.phone).trim().length > 0,
      sport: sportLabel(row.primary_sport),
    })), today);
  } catch (error) {
    logCaught("catalog", "catalog.pulse", error, { target: "admin.overview" });
    return emptyCatalogPulse(today);
  }
}
