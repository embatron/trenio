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

/** The catalog city the map is looking at. A chosen city wins. Otherwise the frame must hold one city center. */
export function mapConsideredCity(cityName: string, frame: MapCityFrame): string | null {
  const named = cityCatalogByName(cityName);
  if (cityName.trim()) return named?.name ?? null;
  if (frame.world) return null;
  const spanLat = Math.abs(frame.north - frame.south);
  const spanLng = frame.wraps
    ? (180 - frame.west) + (frame.east + 180)
    : Math.abs(frame.east - frame.west);
  const south = Math.min(frame.south, frame.north) - spanLat * 0.35;
  const north = Math.max(frame.south, frame.north) + spanLat * 0.35;
  const west = frame.wraps ? frame.west : Math.min(frame.west, frame.east) - spanLng * 0.35;
  const east = frame.wraps ? frame.east : Math.max(frame.west, frame.east) + spanLng * 0.35;
  const inside = listCityCatalogPages().filter((city) => contains(city.lat, city.lng, {
    south,
    west,
    north,
    east,
    wraps: frame.wraps,
  }));
  if (inside.length !== 1) return null;
  return inside[0].name;
}
