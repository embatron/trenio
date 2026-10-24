import { normalizeQuery, sanitizeQuery } from "@/lib/geo/normalize";

/**
 * Public Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 * - At most 1 request per second from this server's IP.
 * - Send a User-Agent that identifies Trenio.by.
 * - Cache every result. Callers must read `geocode_cache` before calling this module.
 * This process spaces outbound calls by at least 1100 ms. Do not call Nominatim from the browser.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Trenio.by/1.0 (https://trenio.by)";
const TIMEOUT_MS = 8_000;
const MIN_INTERVAL_MS = 1_100;

export type GeocodeHit = {
  lat: number;
  lng: number;
  displayName: string;
  city: string;
  district: string;
  street: string;
  countryCode: string;
};

export type GeocodeFetchResult =
  | { kind: "ok"; hits: GeocodeHit[] }
  | { kind: "not_found" }
  | { kind: "unavailable" };

let lastCallAt = 0;
let paceChain: Promise<void> = Promise.resolve();

function pace(): Promise<void> {
  const run = paceChain.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  paceChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function textPart(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseHit(value: unknown): GeocodeHit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { lat?: unknown; lon?: unknown; display_name?: unknown; address?: Record<string, unknown> };
  const lat = typeof row.lat === "string" ? Number(row.lat) : Number.NaN;
  const lng = typeof row.lon === "string" ? Number(row.lon) : Number.NaN;
  const displayName = typeof row.display_name === "string" ? row.display_name.trim() : "";
  const address = row.address ?? {};
  const countryCode = textPart(address.country_code).toLowerCase();
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (displayName.length < 3 || !countryCode) return null;
  const city = textPart(address.city) || textPart(address.town) || textPart(address.village) || textPart(address.hamlet) || textPart(address.municipality);
  const district = textPart(address.suburb) || textPart(address.city_district) || textPart(address.borough) || textPart(address.county) || textPart(address.state_district);
  const street = [textPart(address.road) || textPart(address.pedestrian), textPart(address.house_number)].filter(Boolean).join(", ")
    || displayName.split(",")[0]?.trim()
    || displayName;
  return {
    lat,
    lng,
    displayName: displayName.slice(0, 200),
    city: city.slice(0, 120),
    district: district.slice(0, 120),
    street: street.slice(0, 200),
    countryCode,
  };
}

export type NominatimSearchOptions = {
  /** `null` searches without a country filter. Default is Belarus. */
  countrycodes?: string | null;
  limit?: number;
  belarusOnly?: boolean;
};

/** Low-level search. Network and HTTP failures resolve to `unavailable` and do not throw. */
export async function searchNominatim(query: string, options: NominatimSearchOptions = {}): Promise<GeocodeFetchResult> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized || !normalizeQuery(sanitized)) return { kind: "not_found" };
  const limit = Math.min(5, Math.max(1, options.limit ?? 1));
  const belarusOnly = options.belarusOnly !== false;
  const countrycodes = options.countrycodes === undefined ? "by" : options.countrycodes;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("limit", String(limit));
  if (countrycodes) url.searchParams.set("countrycodes", countrycodes);
  url.searchParams.set("q", sanitized);

  await pace();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru,ru;q=0.9",
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) return { kind: "unavailable" };
    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) return { kind: "unavailable" };
    const hits = body
      .map(parseHit)
      .filter((hit): hit is GeocodeHit => hit != null && (!belarusOnly || hit.countryCode === "by"))
      .slice(0, limit);
    if (hits.length === 0) return { kind: "not_found" };
    return { kind: "ok", hits };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One result, or null when Nominatim is unreachable or the address is unknown.
 * Prefer `searchNominatim` when the caller must tell "not found" from "unavailable".
 */
/** Worldwide lookup used only to reject an address that belongs to another country. */
export async function probeAddressCountry(query: string): Promise<"by" | "foreign" | "not_found" | "unavailable"> {
  const result = await searchNominatim(query, { limit: 1, countrycodes: null, belarusOnly: false });
  if (result.kind === "unavailable") return "unavailable";
  const hit = result.kind === "ok" ? result.hits[0] : undefined;
  if (!hit) return "not_found";
  if (hit.countryCode === "by") return "by";
  return "foreign";
}

export async function geocodeAddress(
  query: string,
  options: NominatimSearchOptions = {},
): Promise<GeocodeHit | null> {
  const result = await searchNominatim(query, { ...options, limit: 1 });
  if (result.kind !== "ok") return null;
  return result.hits[0] ?? null;
}
