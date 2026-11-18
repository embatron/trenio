import { cityCatalogBySlug, listCityCatalogPages } from "@/lib/catalog/city-pages";
import { BELARUS_CITIES, resolveBelarusCity } from "@/lib/catalog/city-taxonomy";

/** One frame lists at most this many cities in the address-less block. */
export const MAP_FRAME_CITY_CAP = 50;

/** Map search value that means every city, not a detected one. */
export const MAP_ALL_CITIES = "all";

/** The city the map filter should show. `nationwide` is the explicit whole-country choice. */
export function explicitMapCity(param: string | undefined, detectedSlug: string | undefined): {
  slug: string | null;
  nationwide: boolean;
} {
  if (param === MAP_ALL_CITIES) return { slug: null, nationwide: true };
  if (param) {
    const page = cityCatalogBySlug(param);
    return { slug: page?.slug ?? null, nationwide: false };
  }
  const detected = detectedSlug ? cityCatalogBySlug(detectedSlug) : null;
  return detected ? { slug: detected.slug, nationwide: false } : { slug: null, nationwide: false };
}

export type MapCityFrame = {
  south: number;
  west: number;
  north: number;
  east: number;
  world?: boolean;
  wraps?: boolean;
};

function contains(lat: number, lng: number, frame: MapCityFrame) {
  if (lat < frame.south || lat > frame.north) return false;
  if (frame.world) return true;
  if (frame.wraps) return lng >= frame.west || lng <= frame.east;
  return lng >= frame.west && lng <= frame.east;
}

function foldCity(name: string) {
  return name.trim().toLowerCase().replaceAll("ё", "е");
}

/** A Belarus city from the full list, not only a city that has its own catalog page. */
function namedBelarusCity(raw: string): string | null {
  const folded = foldCity(raw);
  if (!folded) return null;
  const exact = BELARUS_CITIES.find((name) => foldCity(name) === folded);
  return exact ?? resolveBelarusCity(raw);
}

/**
 * Cities for the address-less list on this frame.
 * A chosen city stays that city, including a small one such as Марьина Горка.
 * Otherwise a city counts when its center lies in the frame, or a trainer with
 * a precise point in the frame belongs to it. The frame keeps at most 50 cities.
 */
export function mapFrameCities(cityName: string, frame: MapCityFrame, pinCities: string[] = []): string[] {
  if (cityName.trim()) {
    const named = namedBelarusCity(cityName);
    return named ? [named] : [];
  }
  const names = new Set<string>();
  for (const city of listCityCatalogPages()) {
    if (contains(city.lat, city.lng, frame)) names.add(city.name);
  }
  for (const raw of pinCities) {
    const named = namedBelarusCity(raw);
    if (named) names.add(named);
  }
  const catalog = listCityCatalogPages().flatMap((city) => (names.has(city.name) ? [city.name] : []));
  const rest = [...names].filter((name) => !catalog.includes(name));
  return [...catalog, ...rest].slice(0, MAP_FRAME_CITY_CAP);
}
