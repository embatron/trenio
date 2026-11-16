import { AuthError } from "@/lib/auth/errors";
import { logCaught, writeLog } from "@/lib/log/logger";
import { readGeocodeCache, readGeocodeCacheMany, writeGeocodeCache, type CachedGeocode } from "@/lib/geo/cache";
import { probeAddressCountry, searchNominatim, type GeocodeHit } from "@/lib/geo/nominatim";
import { addressHitScore, addressQueryReady, addressSearches, normalizeQuery, sanitizeQuery, type AddressSearch } from "@/lib/geo/normalize";
import {
  FOREIGN_ADDRESS_MESSAGE,
  MAP_TEMPORARILY_UNAVAILABLE,
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

function planKey(plan: AddressSearch, structured: boolean): string | null {
  const raw = structured && plan.street ? `street ${plan.street} ${plan.city ?? ""}` : plan.q;
  return normalizeQuery(raw);
}

function rankedHits(plan: AddressSearch, hits: GeocodeHit[]): GeocodeHit[] {
  return hits
    .filter((hit) => hit.countryCode === "by")
    .map((hit) => ({ hit, score: addressHitScore(plan.q, hit, plan) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.hit);
}

type LookupResult =
  | { kind: "ok"; hit: GeocodeHit; hits: GeocodeHit[] }
  | { kind: "not_found" }
  | { kind: "foreign" }
  | { kind: "unavailable" }
  | { kind: "limited" }
  | { kind: "stale" };

type LookupOptions = {
  bypassCache?: boolean;
  /** Caps Nominatim calls. A suggestion uses two, and the second only after a miss. Saving a place uses four. */
  remoteBudget: number;
  probeForeign?: boolean;
  /** A suggestion does not store an empty result. Saving a place does. */
  rememberMiss?: boolean;
  /** Structured street search. A suggestion uses the free-text line instead. */
  structured?: boolean;
  /** False once this field has a newer line. Checked before a remote call. */
  stillCurrent?: () => boolean;
  /** Called once, and only when a remote call is about to start. */
  allowRemote?: () => Promise<boolean>;
};

function stillCurrent(options: LookupOptions) {
  return options.stillCurrent == null || options.stillCurrent();
}

async function rememberHit(key: string, hit: GeocodeHit, hits: GeocodeHit[], original: string | null) {
  const writes = new Map<string, GeocodeHit>();
  writes.set(key, hit);
  if (original && original !== key) writes.set(original, hit);
  for (const item of hits) {
    const displayNorm = normalizeQuery(item.displayName);
    if (displayNorm && !writes.has(displayNorm)) writes.set(displayNorm, item);
  }
  await Promise.all([...writes].map(([cacheKey, value]) => writeCache(cacheKey, value)));
}

/**
 * Try the canonical street, then a spelling or word-order variant.
 * A cached miss on one variant does not hide a later variant.
 * A hit that does not share the street or the place name is not accepted.
 * Variants are read from the cache in one query. A remote call starts only
 * for a variant that is still the latest line of that field.
 */
async function lookup(query: string, cityHint: string, options: LookupOptions): Promise<LookupResult> {
  const bypassCache = options.bypassCache === true;
  const rememberMiss = options.rememberMiss !== false;
  const structured = options.structured !== false;
  const plans = addressSearches(query, cityHint);
  if (!plans.length) return { kind: "not_found" };
  const keys = plans.map((plan) => planKey(plan, structured));
  if (!keys.some(Boolean)) return { kind: "not_found" };

  const cachedRows = bypassCache
    ? new Map<string, CachedGeocode>()
    : await readCaches(keys.filter((key): key is string => Boolean(key)));

  if (!bypassCache) {
    let everyVariantCached = true;
    for (const [index, key] of keys.entries()) {
      if (!key) {
        everyVariantCached = false;
        continue;
      }
      const cached = cachedRows.get(key);
      if (!cached) {
        everyVariantCached = false;
        continue;
      }
      if (cached.foreign) return { kind: "foreign" };
      const plan = plans[index];
      if (cached.hit && plan && addressHitScore(plan.q, cached.hit, plan) > 0) {
        return { kind: "ok", hit: cached.hit, hits: [cached.hit] };
      }
    }
    if (everyVariantCached) return { kind: "not_found" };
  }

  let remoteCalls = 0;
  let remoteAllowed: Promise<boolean> | null = null;
  for (const [index, plan] of plans.entries()) {
    const key = keys[index];
    if (!key) continue;
    if (!bypassCache && cachedRows.has(key)) continue;
    if (remoteCalls >= options.remoteBudget) break;
    if (!stillCurrent(options)) return { kind: "stale" };
    remoteAllowed ??= options.allowRemote?.() ?? Promise.resolve(true);
    if (!(await remoteAllowed)) return { kind: "limited" };
    if (!stillCurrent(options)) return { kind: "stale" };
    remoteCalls += 1;
    const remote = await searchNominatim(plan.q, {
      limit: 5,
      countrycodes: "by",
      belarusOnly: true,
      street: structured ? plan.street : null,
      city: structured ? plan.city : null,
    });
    if (remote.kind === "unavailable") return remote;
    const hits = remote.kind === "ok" ? rankedHits(plan, remote.hits) : [];
    const hit = hits[0] ?? null;
    if (!hit) {
      if (rememberMiss) await writeCache(key, null);
      continue;
    }
    await rememberHit(key, hit, hits, normalizeQuery(query));
    return { kind: "ok", hit, hits };
  }

  if (remoteCalls === 0 || !options.probeForeign) return { kind: "not_found" };
  if (!stillCurrent(options)) return { kind: "stale" };
  const probe = await probeAddressCountry(plans[0]?.q ?? query);
  if (probe === "foreign") {
    await Promise.all(keys.filter((key): key is string => Boolean(key)).map((key) => writeCache(key, null, "other")));
    return { kind: "foreign" };
  }
  if (probe === "unavailable") return { kind: "unavailable" };
  return { kind: "not_found" };
}

async function readCaches(keys: string[]): Promise<Map<string, CachedGeocode>> {
  try {
    return await readGeocodeCacheMany(keys);
  } catch (error) {
    logCaught("geo", "geo.cache.read", error);
    return new Map();
  }
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

  const result = await lookup(address, "", { bypassCache: force, remoteBudget: 4, probeForeign: true });
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

export type SuggestLookup =
  | { kind: "ok"; hits: GeocodeHit[] }
  | { kind: "unavailable" }
  | { kind: "limited" };

export async function suggestCachedOrRemote(
  query: string,
  allowRemote: () => Promise<boolean>,
  stillCurrent?: () => boolean,
): Promise<SuggestLookup> {
  if (!addressQueryReady(query)) return { kind: "ok", hits: [] };
  const result = await lookup(query, "", {
    remoteBudget: 2,
    rememberMiss: false,
    structured: false,
    stillCurrent,
    allowRemote,
  });
  if (result.kind === "unavailable") return { kind: "unavailable" };
  if (result.kind === "limited") return { kind: "limited" };
  if (result.kind === "ok") return { kind: "ok", hits: result.hits.slice(0, 5) };
  return { kind: "ok", hits: [] };
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
  let reportedUnavailable = false;
  for (const row of rows) {
    const current = existing.find((place) => samePlaceText(place, row)) ?? null;
    if (!force && current?.geocodeStatus === "ok" && current.lat != null && current.lng != null) {
      resolved.push(current);
      continue;
    }
    const query = [row.address, row.city].map((part) => part.trim()).filter(Boolean).join(", ");
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
    const result = await lookup(row.address, row.city, { bypassCache: force, remoteBudget: 4, probeForeign: true });
    if (result.kind === "foreign") throw new AuthError(FOREIGN_ADDRESS_MESSAGE, "VALIDATION");
    if (result.kind === "ok") {
      resolved.push(fromHit(row, result.hit));
      continue;
    }
    if (result.kind === "unavailable" && !reportedUnavailable) {
      reportedUnavailable = true;
      void writeLog({
        level: "warn",
        domain: "geo",
        action: "geo.profile",
        outcome: "failure",
        message: MAP_TEMPORARILY_UNAVAILABLE,
      });
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
