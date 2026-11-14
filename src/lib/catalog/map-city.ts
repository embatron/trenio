import { cityCatalogByName, listCityCatalogPages } from "@/lib/catalog/city-pages";

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

/**
 * Catalog cities for the address-less list on this frame.
 * A chosen city stays that city. Otherwise a city counts when its center
 * lies in the frame, or a trainer with a precise point in the frame belongs to it.
 * A zoomed neighborhood and a zoomed-out frame both keep their cities.
 */
export function mapFrameCities(cityName: string, frame: MapCityFrame, pinCities: string[] = []): string[] {
  if (cityName.trim()) {
    const named = cityCatalogByName(cityName);
    return named ? [named.name] : [];
  }
  const names = new Set<string>();
  for (const city of listCityCatalogPages()) {
    if (contains(city.lat, city.lng, frame)) names.add(city.name);
  }
  for (const raw of pinCities) {
    const named = cityCatalogByName(raw);
    if (named) names.add(named.name);
  }
  return listCityCatalogPages().flatMap((city) => (names.has(city.name) ? [city.name] : []));
}
