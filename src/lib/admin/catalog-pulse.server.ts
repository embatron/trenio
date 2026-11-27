import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { buildCatalogPulse, emptyCatalogPulse, type CatalogPulse } from "@/lib/admin/catalog-pulse";
import { getSportTaxonomyParent, getTopLevelSportCategory } from "@/lib/catalog/sport-taxonomy";
import { ensureTrainerPublishedAt } from "@/lib/catalog/trainer-published";
import { readTrainingPlaces } from "@/lib/geo/schemas";
import { logCaught } from "@/lib/log/logger";

function sportRecord(value: unknown): { slug: string; parentSlug: string } | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return sportRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const row = value as { slug?: unknown; parentSlug?: unknown };
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  const parentSlug = typeof row.parentSlug === "string" ? row.parentSlug.trim() : "";
  if (!slug && !parentSlug) return null;
  return { slug, parentSlug };
}

/** The site section of the primary sport, such as «Единоборства», not the sport itself. */
function sectionName(value: unknown): string {
  const record = sportRecord(value);
  if (!record) return "";
  const section = (record.parentSlug ? getTopLevelSportCategory(record.parentSlug) : undefined)
    ?? getSportTaxonomyParent(record.slug)
    ?? getTopLevelSportCategory(record.slug);
  return section?.label.trim() ?? "";
}

function addressLines(address: unknown, places: unknown): string[] {
  const lines: string[] = [];
  const main = text(address).trim();
  if (main) lines.push(main);
  for (const place of readTrainingPlaces(places)) {
    const line = place.address.trim();
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines;
}

function placeFlags(address: unknown, places: unknown) {
  const lines = addressLines(address, places);
  return {
    hasAddress: lines.length > 0,
  };
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
        address,
        training_places,
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
      ...placeFlags(row.address, row.training_places),
      section: sectionName(row.primary_sport),
    })), today);
  } catch (error) {
    logCaught("catalog", "catalog.pulse", error, { target: "admin.overview" });
    return emptyCatalogPulse(today);
  }
}
