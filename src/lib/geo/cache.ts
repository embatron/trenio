import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { geocodeCache, type GeocodeCacheRow } from "@/db/schema";
import type { GeocodeHit } from "@/lib/geo/nominatim";

const TTL_MS = 180 * 24 * 60 * 60 * 1000;

export type CachedGeocode = {
  /** Null hit means Nominatim previously returned no Belarus result. */
  hit: GeocodeHit | null;
  /** The query resolved to a country other than Belarus. */
  foreign: boolean;
};

function cachedFromRow(row: GeocodeCacheRow): CachedGeocode | null {
  if (Date.now() - row.createdAt.getTime() > TTL_MS) return null;
  if (row.countryCode && row.countryCode !== "by") return { hit: null, foreign: true };
  if (row.lat == null || row.lng == null || !row.displayName) return { hit: null, foreign: false };
  return {
    foreign: false,
    hit: {
      lat: row.lat,
      lng: row.lng,
      displayName: row.displayName,
      city: row.city ?? "",
      district: row.district ?? "",
      street: row.street ?? "",
      region: "",
      country: "",
      countryCode: "by",
    },
  };
}

export async function readGeocodeCache(queryNorm: string): Promise<CachedGeocode | null> {
  const [row] = await getDb().select().from(geocodeCache).where(eq(geocodeCache.queryNorm, queryNorm)).limit(1);
  if (!row) return null;
  return cachedFromRow(row);
}

/** One round trip for every spelling of the same address. A missing key is not in the map. */
export async function readGeocodeCacheMany(queryNorms: string[]): Promise<Map<string, CachedGeocode>> {
  const unique = [...new Set(queryNorms.filter(Boolean))];
  const found = new Map<string, CachedGeocode>();
  if (unique.length === 0) return found;
  const rows = await getDb().select().from(geocodeCache).where(inArray(geocodeCache.queryNorm, unique));
  for (const row of rows) {
    const cached = cachedFromRow(row);
    if (cached) found.set(row.queryNorm, cached);
  }
  return found;
}

export async function writeGeocodeCache(queryNorm: string, hit: GeocodeHit | null, countryCode?: string | null): Promise<void> {
  const db = getDb();
  const values = {
    queryNorm,
    lat: hit?.lat ?? null,
    lng: hit?.lng ?? null,
    displayName: hit?.displayName ?? null,
    city: hit?.city ?? null,
    district: hit?.district ?? null,
    street: hit?.street ?? null,
    countryCode: hit?.countryCode ?? countryCode ?? null,
    createdAt: new Date(),
  };
  await db
    .insert(geocodeCache)
    .values(values)
    .onConflictDoUpdate({
      target: geocodeCache.queryNorm,
      set: {
        lat: values.lat,
        lng: values.lng,
        displayName: values.displayName,
        city: values.city,
        district: values.district,
        street: values.street,
        countryCode: values.countryCode,
        createdAt: values.createdAt,
      },
    });
}
