import { AuthError } from "@/lib/auth/errors";
import { logCaught } from "@/lib/log/logger";
import { readGeocodeCache, writeGeocodeCache, type CachedGeocode } from "@/lib/geo/cache";
import { probeAddressCountry, searchNominatim, type GeocodeHit } from "@/lib/geo/nominatim";
import { normalizeQuery, sanitizeQuery } from "@/lib/geo/normalize";
import {
  FOREIGN_ADDRESS_MESSAGE,
  MAX_TRAINING_PLACES,
  placeHasText,
  placeLine,
  type GeocodeStatus,
  type TrainerPlace,
} from "@/lib/geo/schemas";

export type StoredAddress = {
  address: string | null;
  addressLat: number | null;
  addressLng: number | null;
  geocodeStatus: GeocodeStatus | null;
};

const COORD_EPSILON = 0.0002;

function blankAddress(raw: string | null | undefined): string | null {
  const text = raw?.trim() ?? "";
  return text ? text.slice(0, 200) : null;
}

function inBelarus(lat: number, lng: number) {
  return lat >= 51.15 && lat <= 56.2 && lng >= 23.1 && lng <= 32.8;
}

function samePoint(lat: number, lng: number, hit: GeocodeHit) {
  return Math.abs(lat - hit.lat) < COORD_EPSILON && Math.abs(lng - hit.lng) < COORD_EPSILON;
}

async function readCache(queryNorm: string): Promise<CachedGeocode | "miss"> {
  try {
    const cached = await readGeocodeCache(queryNorm);
    return cached ?? "miss";
  } catch (error) {
    logCaught("geo", "geo.cache.read", error);
    return "miss";
  }
}

async function writeCache(queryNorm: string, hit: GeocodeHit | null, countryCode?: string | null) {
  try {
    await writeGeocodeCache(queryNorm, hit, countryCode);
  } catch (error) {
    logCaught("geo", "geo.cache.write", error);
  }
}

async function lookup(query: string, bypassCache: boolean): Promise<
  | { kind: "ok"; hit: GeocodeHit }
  | { kind: "not_found" }
  | { kind: "foreign" }
  | { kind: "unavailable" }
> {
  const norm = normalizeQuery(query);
  if (!norm) return { kind: "not_found" };
  if (!bypassCache) {
    const cached = await readCache(norm);
    if (cached !== "miss") {
      if (cached.foreign) return { kind: "foreign" };
      return cached.hit ? { kind: "ok", hit: cached.hit } : { kind: "not_found" };
    }
  }
  const remote = await searchNominatim(query, { limit: 1, countrycodes: "by", belarusOnly: true });
  if (remote.kind === "unavailable") return remote;
  const hit = remote.kind === "ok" ? remote.hits[0] : undefined;
  if (!hit || hit.countryCode !== "by") {
    const probe = await probeAddressCountry(query);
    if (probe === "foreign") {
      await writeCache(norm, null, "other");
      return { kind: "foreign" };
    }
    if (probe === "unavailable") return { kind: "unavailable" };
    await writeCache(norm, null);
    return { kind: "not_found" };
  }
  await writeCache(norm, hit);
  const displayNorm = normalizeQuery(hit.displayName);
  if (displayNorm && displayNorm !== norm) await writeCache(displayNorm, hit);
  return { kind: "ok", hit };
}

/**
 * Decide what to store on a trainer profile.
 * An unchanged address that already geocoded does not call Nominatim.
 * A failed lookup never blocks the save: the text is kept and the status records why there is no point.
 */
export async function resolveProfileAddress(
  input: { address: string | null; addressLat: number | null; addressLng: number | null },
  existing: StoredAddress | null,
  options?: { force?: boolean },
): Promise<StoredAddress> {
  const address = blankAddress(input.address);
  if (!address) {
    return { address: null, addressLat: null, addressLng: null, geocodeStatus: null };
  }
  if (!sanitizeQuery(address)) {
    return { address, addressLat: null, addressLng: null, geocodeStatus: "not_found" };
  }

  const force = options?.force === true;
  const sameText = (existing?.address?.trim() ?? "") === address;
  if (
    !force
    && sameText
    && existing?.geocodeStatus === "ok"
    && existing.addressLat != null
    && existing.addressLng != null
  ) {
    return {
      address,
      addressLat: existing.addressLat,
      addressLng: existing.addressLng,
      geocodeStatus: "ok",
    };
  }

  const norm = normalizeQuery(address);
  if (!force && norm && input.addressLat != null && input.addressLng != null) {
    const cached = await readCache(norm);
    if (cached !== "miss" && cached.hit && samePoint(input.addressLat, input.addressLng, cached.hit)) {
      return {
        address,
        addressLat: cached.hit.lat,
        addressLng: cached.hit.lng,
        geocodeStatus: "ok",
      };
    }
  }

  const result = await lookup(address, force);
  if (result.kind === "ok") {
    return {
      address,
      addressLat: result.hit.lat,
      addressLng: result.hit.lng,
      geocodeStatus: "ok",
    };
  }
  if (result.kind === "foreign") throw new AuthError(FOREIGN_ADDRESS_MESSAGE, "VALIDATION");
  if (result.kind === "not_found") {
    return { address, addressLat: null, addressLng: null, geocodeStatus: "not_found" };
  }
  return { address, addressLat: null, addressLng: null, geocodeStatus: "pending" };
}

/** Profile save must succeed even when the cache or geocoder throws. */
export async function resolveProfileAddressSafe(
  input: { address: string | null; addressLat: number | null; addressLng: number | null },
  existing: StoredAddress | null,
): Promise<StoredAddress> {
  try {
    return await resolveProfileAddress(input, existing);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    logCaught("geo", "geo.profile", error);
    const address = input.address?.trim() ? input.address.trim().slice(0, 200) : null;
    return {
      address,
      addressLat: null,
      addressLng: null,
      geocodeStatus: address ? "pending" : null,
    };
  }
}

export async function suggestCachedOrRemote(
  query: string,
  allowRemote: () => boolean,
): Promise<GeocodeHit[] | "limited"> {
  const norm = normalizeQuery(query);
  if (!norm) return [];
  const cached = await readCache(norm);
  if (cached !== "miss") {
    if (cached.foreign || !cached.hit) return [];
    return [cached.hit];
  }
  if (!allowRemote()) return "limited";

  const remote = await searchNominatim(query, { limit: 5, countrycodes: "by", belarusOnly: true });
  if (remote.kind !== "ok") return [];
  await writeCache(norm, remote.hits[0] ?? null);
  for (const hit of remote.hits) {
    const displayNorm = normalizeQuery(hit.displayName);
    if (displayNorm) await writeCache(displayNorm, hit);
  }
  return remote.hits.filter((hit) => hit.countryCode === "by").slice(0, 5);
}

function placeQuery(place: { city: string; district: string; address: string }) {
  return [place.address, place.district, place.city, "Беларусь"].map((part) => part.trim()).filter(Boolean).join(", ");
}

function samePlaceText(a: TrainerPlace, b: { city: string; district: string; address: string }) {
  return a.city.trim() === b.city.trim() && a.district.trim() === b.district.trim() && a.address.trim() === b.address.trim();
}

function fromHit(fallback: { city: string; district: string; address: string }, hit: GeocodeHit): TrainerPlace {
  return {
    city: hit.city || fallback.city.trim(),
    district: hit.district || fallback.district.trim(),
    address: hit.street || fallback.address.trim(),
    lat: hit.lat,
    lng: hit.lng,
    geocodeStatus: "ok",
  };
}

/**
 * Up to three Belarus places. A resolved address outside Belarus throws.
 * Network failures keep the text and set `pending`.
 */
export async function resolveTrainingPlaces(
  input: Array<{ city: string; district: string; address: string; lat: number | null; lng: number | null }>,
  existing: TrainerPlace[],
  options?: { force?: boolean },
): Promise<TrainerPlace[]> {
  const force = options?.force === true;
  const rows = input.filter(placeHasText).slice(0, MAX_TRAINING_PLACES);
  const resolved: TrainerPlace[] = [];
  for (const row of rows) {
    const current = existing.find((place) => samePlaceText(place, row)) ?? null;
    if (!force && current?.geocodeStatus === "ok" && current.lat != null && current.lng != null) {
      resolved.push(current);
      continue;
    }
    const query = placeQuery(row);
    const norm = normalizeQuery(query);
    if (!force && norm && row.lat != null && row.lng != null) {
      const cached = await readCache(norm);
      if (cached !== "miss" && cached.foreign) throw new AuthError(FOREIGN_ADDRESS_MESSAGE, "VALIDATION");
      if (cached !== "miss" && cached.hit && samePoint(row.lat, row.lng, cached.hit)) {
        resolved.push(fromHit(row, cached.hit));
        continue;
      }
      if (inBelarus(row.lat, row.lng)) {
        resolved.push({
          city: row.city.trim(),
          district: row.district.trim(),
          address: row.address.trim(),
          lat: row.lat,
          lng: row.lng,
          geocodeStatus: "ok",
        });
        continue;
      }
    }
    const result = await lookup(query, force);
    if (result.kind === "foreign") throw new AuthError(FOREIGN_ADDRESS_MESSAGE, "VALIDATION");
    if (result.kind === "ok") {
      resolved.push(fromHit(row, result.hit));
      continue;
    }
    resolved.push({
      city: row.city.trim(),
      district: row.district.trim(),
      address: row.address.trim(),
      lat: null,
      lng: null,
      geocodeStatus: result.kind === "not_found" ? "not_found" : "pending",
    });
  }
  return resolved;
}

export function mirrorTrainingPlace(places: TrainerPlace[]) {
  const first = places.find((place) => place.geocodeStatus === "ok" && place.lat != null && place.lng != null) ?? places[0];
  if (!first) {
    return { address: null, addressLat: null, addressLng: null, geocodeStatus: null as GeocodeStatus | null };
  }
  return {
    address: placeLine(first) || null,
    addressLat: first.lat,
    addressLng: first.lng,
    geocodeStatus: first.geocodeStatus,
  };
}
