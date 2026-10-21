import {
  detectVisitorPlaceFn,
  parseVisitorPlace,
  resolveVisitorPlaceFn,
  VISITOR_PLACE_COOKIE,
  type VisitorPlace,
} from "@/lib/catalog/visitor-place";

export const DEFAULT_SEARCH_CITY = "Минск";

/** City pills for a catalog filter: saved cities, or Минск when nothing is known. */
export function catalogFilterCities(place: { cities: string[]; query: string }): string[] {
  if (place.cities.length > 0) return place.cities;
  if (place.query.trim()) return [];
  return [DEFAULT_SEARCH_CITY];
}

function cityFromPlace(place: VisitorPlace | null): string | null {
  if (!place || place.dismissed) return null;
  const city = place.cities[0]?.trim() || place.query.trim();
  return city || null;
}

export function readVisitorPlaceCookie(): VisitorPlace | null {
  if (typeof document === "undefined") return null;
  const prefix = `${VISITOR_PLACE_COOKIE}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return parseVisitorPlace(raw);
}

let pendingCity: Promise<string> | null = null;

/** Detected or saved settlement, otherwise Минск. Shared by every search form on the page. */
export function resolveSearchCity(): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(DEFAULT_SEARCH_CITY);
  if (!pendingCity) {
    pendingCity = (async () => {
      const saved = cityFromPlace(readVisitorPlaceCookie());
      if (saved) return saved;
      try {
        const place = await resolveVisitorPlaceFn();
        const known = place.cities[0]?.trim() || place.query.trim();
        if (known) return known;
        if (place.lookupOnClient) {
          const response = await fetch("https://api.ipify.org?format=json", {
            signal: AbortSignal.timeout(4000),
          });
          if (response.ok) {
            const data = (await response.json()) as { ip?: unknown };
            if (typeof data.ip === "string" && data.ip) {
              const detected = await detectVisitorPlaceFn({ data: { ip: data.ip } });
              const city = detected.cities[0]?.trim() || detected.query.trim();
              if (city) return city;
            }
          }
        }
      } catch {
        // The field stays on the default city.
      }
      return DEFAULT_SEARCH_CITY;
    })();
  }
  return pendingCity;
}
