import { and, avg, count, eq, inArray, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { catalogCategorySports, catalogSportById } from "@/lib/catalog/catalog-sports";
import type { MapAreaInput } from "@/lib/catalog/map-area-input";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import type { TrainerAudience, TrainerFormat } from "@/lib/catalog/published-trainers";
import { trainerNameParts } from "@/lib/catalog/trainer-name";
import { placesFromProfile } from "@/lib/geo/schemas";

export const MAP_PAGE_SIZE = 12;
const PIN_POINT_CAP = 80;
const CLUSTER_CAP = 180;
const TOOLTIP_CAP = 8;
const SLUG_CAP = 200;

export type MapTrainerPlace = {
  city: string;
  address: string;
  lat: number;
  lng: number;
};

export type MapTrainer = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  photo: string;
  city: string;
  price: number;
  experience: number;
  audiences: TrainerAudience[];
  formats: TrainerFormat[];
  sportSlugs: string[];
  sportParents: string[];
  tags: string[];
  rating: string;
  reviews: number;
  places: MapTrainerPlace[];
};

export type MapAreaTrainer = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  photo: string;
  tags: string[];
  rating: string;
  reviews: number;
  price: number;
};

export type MapAreaFeature =
  | {
    kind: "pin";
    key: string;
    lat: number;
    lng: number;
    label: string;
    count: number;
    slugs: string[];
    trainers: MapAreaTrainer[];
  }
  | {
    kind: "cluster";
    key: string;
    lat: number;
    lng: number;
    count: number;
  };

export type MapArea = {
  total: number;
  addressCount: number;
  matched: number;
  nextCursor: number | null;
  trainers: MapTrainer[];
  features: MapAreaFeature[];
  priceMin: number;
  priceMax: number;
};

type AreaFilters = {
  sports: string[];
  city: string;
  audience: "self" | "child" | null;
  formats: Array<"individual" | "group">;
  minExperience: number | null;
  priceMin: number | null;
  priceMax: number | null;
};

type AreaBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  world: boolean;
  wraps: boolean;
};

function isAudience(value: unknown): value is TrainerAudience {
  return value === "adult" || value === "kid" || value === "teen";
}

function isFormat(value: unknown): value is TrainerFormat {
  return value === "individual" || value === "group";
}

function foldCity(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function inList(values: string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `);
}

function profileWhere(filters: AreaFilters, applyPrice: boolean): SQL {
  const parts: SQL[] = [sql`tp.status = 'published'`];
  if (filters.sports.length > 0) {
    const clauses = filters.sports.map((id) => {
      const sport = catalogSportById(id);
      if (!sport || sport.level === 1) {
        const slug = sport?.slug ?? id;
        const children = sport ? catalogCategorySports(sport.slug).map((child) => child.slug) : [];
        if (children.length === 0) {
          return sql`(sport->>'parentSlug' = ${slug} OR sport->>'slug' = ${slug})`;
        }
        return sql`(sport->>'parentSlug' = ${slug} OR sport->>'slug' = ${slug} OR sport->>'slug' IN (${inList(children)}))`;
      }
      return sql`(sport->>'slug' = ${sport.slug})`;
    });
    parts.push(sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(tp.sports) = 'array' THEN tp.sports ELSE '[]'::jsonb END
      ) AS sport
      WHERE ${sql.join(clauses, sql` OR `)}
    )`);
  }
  if (filters.audience === "child") {
    parts.push(sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(tp.audiences) = 'array' THEN tp.audiences ELSE '[]'::jsonb END
      ) AS item(value)
      WHERE item.value IN ('kid', 'teen')
    )`);
  } else if (filters.audience === "self") {
    parts.push(sql`(
      coalesce(jsonb_typeof(tp.audiences), '') <> 'array'
      OR jsonb_array_length(tp.audiences) = 0
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(tp.audiences) AS item(value)
        WHERE item.value = 'adult'
      )
    )`);
  }
  if (filters.formats.length > 0) {
    parts.push(sql`(
      coalesce(jsonb_typeof(tp.formats), '') <> 'array'
      OR jsonb_array_length(tp.formats) = 0
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(tp.formats) AS item(value)
        WHERE item.value IN (${inList(filters.formats)})
      )
    )`);
  }
  if (filters.minExperience != null) {
    parts.push(sql`coalesce(tp.experience_years, 0) >= ${filters.minExperience}`);
  }
  if (applyPrice && filters.priceMin != null && filters.priceMax != null) {
    parts.push(sql`coalesce(tp.price_from, 0) >= ${Math.min(filters.priceMin, filters.priceMax)}`);
    parts.push(sql`coalesce(tp.price_from, 0) <= ${Math.max(filters.priceMin, filters.priceMax)}`);
  }
  return sql.join(parts, sql` AND `);
}

function boundsWhere(bounds: AreaBounds | null): SQL {
  if (!bounds) return sql`true`;
  const lat = sql`lat BETWEEN ${bounds.south} AND ${bounds.north}`;
  if (bounds.world) return lat;
  const lng = bounds.wraps
    ? sql`(lng >= ${bounds.west} OR lng <= ${bounds.east})`
    : sql`lng BETWEEN ${bounds.west} AND ${bounds.east}`;
  return sql`${lat} AND ${lng}`;
}

function placesSql(filters: AreaFilters, bounds: AreaBounds | null, applyPrice: boolean): SQL {
  const city = foldCity(filters.city);
  const citySql = city
    ? sql`lower(replace(city, 'ё', 'е')) = ${city}`
    : sql`true`;
  return sql`
    SELECT slug, price_from, lat, lng, city, address
    FROM (
      SELECT
        tp.slug,
        coalesce(tp.price_from, 0)::int AS price_from,
        CASE
          WHEN place->>'lat' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (place->>'lat')::double precision
        END AS lat,
        CASE
          WHEN place->>'lng' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (place->>'lng')::double precision
        END AS lng,
        coalesce(place->>'city', '') AS city,
        coalesce(place->>'address', '') AS address,
        place->>'geocodeStatus' AS geocode_status
      FROM trainer_profiles tp
      CROSS JOIN LATERAL (
        SELECT extracted.place
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(tp.training_places) = 'array' AND jsonb_array_length(tp.training_places) > 0
            THEN tp.training_places
            ELSE '[]'::jsonb
          END
        ) AS extracted(place)
        UNION ALL
        SELECT jsonb_build_object(
          'city', '',
          'address', coalesce(tp.address, ''),
          'lat', tp.address_lat,
          'lng', tp.address_lng,
          'geocodeStatus', tp.geocode_status
        ) AS place
        WHERE coalesce(jsonb_array_length(
          CASE WHEN jsonb_typeof(tp.training_places) = 'array' THEN tp.training_places ELSE '[]'::jsonb END
        ), 0) = 0
          AND length(btrim(coalesce(tp.address, ''))) > 0
      ) AS src(place)
      WHERE ${profileWhere(filters, applyPrice)}
    ) raw
    WHERE geocode_status = 'ok'
      AND lat BETWEEN -90 AND 90
      AND lng BETWEEN -180 AND 180
      AND ${citySql}
      AND ${boundsWhere(bounds)}
  `;
}

function wrapLng(value: number) {
  let lng = value;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return lng;
}

function normalizeBounds(south: number, west: number, north: number, east: number): AreaBounds {
  const latSouth = Math.min(south, north);
  const latNorth = Math.max(south, north);
  if (east - west >= 360) {
    return { south: latSouth, west: -180, north: latNorth, east: 180, world: true, wraps: false };
  }
  const wrappedWest = wrapLng(west);
  const wrappedEast = wrapLng(east);
  const wraps = wrappedWest > wrappedEast;
  return {
    south: latSouth,
    west: wrappedWest,
    north: latNorth,
    east: wrappedEast,
    world: false,
    wraps,
  };
}

function clusterStep(zoom: number, attempt: number) {
  const base = 360 / 2 ** Math.min(18, Math.max(0, zoom));
  return Math.min(120, Math.max(0.0002, (base / 4) * 2 ** attempt));
}

async function queryRows(query: SQL) {
  return asRows(await getDb().execute(query));
}

function toMapTrainer(row: {
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  city: string;
  avatarPath: string;
  photos: string[] | null;
  sports: Array<{ slug?: string; parentSlug?: string; label?: string }> | null;
  audiences: Array<"adult" | "teen" | "kid"> | null;
  formats: Array<"individual" | "group"> | null;
  priceFrom: number | null;
  experienceYears: number | null;
  trainingPlaces: unknown;
  address: string | null;
  addressLat: number | null;
  addressLng: number | null;
  geocodeStatus: string | null;
}): MapTrainer | null {
  const places = placesFromProfile(row).flatMap((place) => {
    if (place.geocodeStatus !== "ok" || place.lat == null || place.lng == null) return [];
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return [];
    return [{ city: place.city, address: place.address, lat: place.lat, lng: place.lng }];
  });
  if (places.length === 0) return null;
  const sports = (row.sports ?? []).flatMap((sport) => {
    const slug = sport?.slug?.trim() ?? "";
    if (!slug) return [];
    return [{
      slug,
      parentSlug: sport.parentSlug?.trim() || slug,
      label: sport.label?.trim() || slug,
    }];
  }).slice(0, 4);
  const name = trainerNameParts(row.firstName, row.lastName, row.fullName);
  return {
    slug: row.slug,
    firstName: name.firstName,
    lastName: name.lastName,
    name: name.fullName || "Тренер",
    photo: (row.photos?.[0] || row.avatarPath || "").split("?")[0],
    city: row.city.trim(),
    price: row.priceFrom ?? 0,
    experience: row.experienceYears ?? 0,
    audiences: (row.audiences ?? []).filter(isAudience),
    formats: (row.formats ?? []).filter(isFormat),
    sportSlugs: sports.map((sport) => sport.slug),
    sportParents: sports.map((sport) => sport.parentSlug),
    tags: sports.map((sport) => sport.label),
    rating: "0",
    reviews: 0,
    places,
  };
}

function inFrame(lat: number, lng: number, bounds: AreaBounds) {
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.world) return true;
  if (bounds.wraps) return lng >= bounds.west || lng <= bounds.east;
  return lng >= bounds.west && lng <= bounds.east;
}

async function loadTrainers(slugs: string[], bounds: AreaBounds, cityName: string) {
  if (slugs.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      fullName: trainerProfiles.fullName,
      city: trainerProfiles.city,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
      sports: trainerProfiles.sports,
      audiences: trainerProfiles.audiences,
      formats: trainerProfiles.formats,
      priceFrom: trainerProfiles.priceFrom,
      experienceYears: trainerProfiles.experienceYears,
      trainingPlaces: trainerProfiles.trainingPlaces,
      address: trainerProfiles.address,
      addressLat: trainerProfiles.addressLat,
      addressLng: trainerProfiles.addressLng,
      geocodeStatus: trainerProfiles.geocodeStatus,
    })
    .from(trainerProfiles)
    .where(and(eq(trainerProfiles.status, "published"), inArray(trainerProfiles.slug, slugs)));
  const city = foldCity(cityName);
  const bySlug = new Map<string, MapTrainer>();
  for (const row of rows) {
    const trainer = toMapTrainer(row);
    if (!trainer) continue;
    const places = trainer.places.filter((place) => {
      if (!inFrame(place.lat, place.lng, bounds)) return false;
      if (city && foldCity(place.city) !== city) return false;
      return true;
    });
    if (places.length === 0) continue;
    bySlug.set(trainer.slug, { ...trainer, places });
  }
  if (bySlug.size === 0) return [];
  const ratings = await db
    .select({
      slug: trainerReviews.trainerSlug,
      reviews: count(),
      average: avg(trainerReviews.rating),
    })
    .from(trainerReviews)
    .where(and(
      eq(trainerReviews.status, "published"),
      inArray(trainerReviews.trainerSlug, [...bySlug.keys()]),
    ))
    .groupBy(trainerReviews.trainerSlug);
  for (const rating of ratings) {
    const trainer = bySlug.get(rating.slug);
    if (!trainer) continue;
    const reviews = Number(rating.reviews ?? 0);
    const average = Number(rating.average);
    if (reviews > 0 && Number.isFinite(average)) {
      trainer.rating = average.toFixed(1);
      trainer.reviews = reviews;
    }
  }
  return slugs.flatMap((slug) => {
    const trainer = bySlug.get(slug);
    return trainer ? [trainer] : [];
  });
}

function cardOf(trainer: MapTrainer): MapAreaTrainer {
  return {
    slug: trainer.slug,
    firstName: trainer.firstName,
    lastName: trainer.lastName,
    name: trainer.name,
    photo: trainer.photo,
    tags: trainer.tags,
    rating: trainer.rating,
    reviews: trainer.reviews,
    price: trainer.price,
  };
}

function pinKey(lat: number, lng: number) {
  return `p:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function pinFeatures(filters: AreaFilters, bounds: AreaBounds): Promise<MapAreaFeature[]> {
  const groups = await queryRows(sql`
    WITH places AS (${placesSql(filters, bounds, true)})
    SELECT
      round(lat::numeric, 5) AS lat_key,
      round(lng::numeric, 5) AS lng_key,
      min(lat) AS lat,
      min(lng) AS lng,
      min(city) AS city,
      min(address) AS address,
      count(DISTINCT slug)::int AS count
    FROM places
    GROUP BY 1, 2
  `);
  const samples = await queryRows(sql`
    WITH places AS (${placesSql(filters, bounds, true)})
    SELECT lat_key, lng_key, slug
    FROM (
      SELECT
        round(lat::numeric, 5) AS lat_key,
        round(lng::numeric, 5) AS lng_key,
        slug,
        row_number() OVER (
          PARTITION BY round(lat::numeric, 5), round(lng::numeric, 5)
          ORDER BY slug
        ) AS n
      FROM places
    ) ranked
    WHERE n <= ${SLUG_CAP}
  `);
  const slugsByKey = new Map<string, string[]>();
  for (const row of samples) {
    const lat = Number(Number(row.lat_key).toFixed(5));
    const lng = Number(Number(row.lng_key).toFixed(5));
    const key = pinKey(lat, lng);
    const slug = typeof row.slug === "string" ? row.slug : "";
    if (!slug) continue;
    const list = slugsByKey.get(key) ?? [];
    list.push(slug);
    slugsByKey.set(key, list);
  }
  const sampleSlugs = [...new Set([...slugsByKey.values()].flatMap((list) => list.slice(0, TOOLTIP_CAP)))];
  const loaded = await loadTrainers(sampleSlugs, bounds, filters.city);
  const bySlug = new Map(loaded.map((trainer) => [trainer.slug, trainer]));
  return groups.flatMap((row) => {
    const lat = Number(Number(row.lat).toFixed(5));
    const lng = Number(Number(row.lng).toFixed(5));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const key = pinKey(lat, lng);
    const slugs = slugsByKey.get(key) ?? [];
    const city = typeof row.city === "string" ? row.city.trim() : "";
    const address = typeof row.address === "string" ? row.address.trim() : "";
    return [{
      kind: "pin" as const,
      key,
      lat,
      lng,
      label: [city, address].filter(Boolean).join(", "),
      count: num(row.count),
      slugs,
      trainers: slugs.slice(0, TOOLTIP_CAP).flatMap((slug) => {
        const trainer = bySlug.get(slug);
        return trainer ? [cardOf(trainer)] : [];
      }),
    }];
  });
}

async function clusterFeatures(filters: AreaFilters, bounds: AreaBounds, zoom: number): Promise<MapAreaFeature[]> {
  let rows: Record<string, unknown>[] = [];
  let step = clusterStep(zoom, 0);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    step = clusterStep(zoom, attempt);
    rows = await queryRows(sql`
      WITH places AS (${placesSql(filters, bounds, true)})
      SELECT
        round((lat / ${step})::numeric) AS gy,
        round((lng / ${step})::numeric) AS gx,
        avg(lat) AS lat,
        avg(lng) AS lng,
        count(DISTINCT slug)::int AS count
      FROM places
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT ${CLUSTER_CAP + 1}
    `);
    if (rows.length <= CLUSTER_CAP) break;
  }
  return rows.slice(0, CLUSTER_CAP).flatMap((row) => {
    const lat = num(row.lat);
    const lng = num(row.lng);
    const gx = num(row.gx);
    const gy = num(row.gy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      kind: "cluster" as const,
      key: `c:${gy}:${gx}:${step.toFixed(5)}`,
      lat,
      lng,
      count: num(row.count),
    }];
  });
}

export async function loadMapArea(input: MapAreaInput): Promise<MapArea> {
  const bounds = normalizeBounds(input.south, input.west, input.north, input.east);
  const filters: AreaFilters = {
    sports: input.sports ?? [],
    city: input.city?.trim() ?? "",
    audience: input.audience ?? null,
    formats: input.formats ?? [],
    minExperience: input.minExperience ?? null,
    priceMin: input.priceMin ?? null,
    priceMax: input.priceMax ?? null,
  };
  const cursor = input.cursor ?? 0;
  const includeFeatures = input.includeFeatures !== false && cursor === 0;
  const spanFilters: AreaFilters = { ...filters, audience: null, formats: [], minExperience: null, priceMin: null, priceMax: null };
  const [spanRows, countRows] = await Promise.all([
    cursor === 0
      ? queryRows(sql`
        WITH places AS (${placesSql(spanFilters, null, false)})
        SELECT
          count(DISTINCT slug)::int AS matched,
          coalesce(min(price_from), 0)::int AS price_min,
          coalesce(max(price_from), 0)::int AS price_max
        FROM places
      `)
      : Promise.resolve([]),
    queryRows(sql`
      WITH places AS (${placesSql(filters, bounds, true)})
      SELECT
        count(*)::int AS places,
        count(DISTINCT slug)::int AS trainers,
        count(DISTINCT (round(lat::numeric, 5)::text || ',' || round(lng::numeric, 5)::text))::int AS points
      FROM places
    `),
  ]);
  const matchedRows = cursor === 0
    ? await queryRows(sql`
      WITH places AS (${placesSql(filters, null, true)})
      SELECT count(DISTINCT slug)::int AS matched
      FROM places
    `)
    : [];
  const total = num(countRows[0]?.trainers);
  const addressCount = num(countRows[0]?.places);
  const points = num(countRows[0]?.points);
  const clat = (bounds.south + bounds.north) / 2;
  const clng = bounds.world || bounds.wraps ? 0 : (bounds.west + bounds.east) / 2;
  const pageRows = await queryRows(sql`
    WITH places AS (${placesSql(filters, bounds, true)})
    SELECT slug
    FROM (
      SELECT slug,
        min(((lat - ${clat}) * (lat - ${clat})) + ((lng - ${clng}) * (lng - ${clng}))) AS dist
      FROM places
      GROUP BY slug
    ) ranked
    ORDER BY dist, slug
    LIMIT ${MAP_PAGE_SIZE} OFFSET ${cursor}
  `);
  const pageSlugs = pageRows.flatMap((row) => (typeof row.slug === "string" ? [row.slug] : []));
  const trainers = await loadTrainers(pageSlugs, bounds, filters.city);
  let features: MapAreaFeature[] = [];
  if (includeFeatures) {
    features = points > PIN_POINT_CAP
      ? await clusterFeatures(filters, bounds, input.zoom)
      : await pinFeatures(filters, bounds);
  }
  const priceMin = num(spanRows[0]?.price_min);
  const rawMax = num(spanRows[0]?.price_max);
  return {
    total,
    addressCount,
    matched: cursor === 0 ? num(matchedRows[0]?.matched) : total,
    nextCursor: cursor + pageSlugs.length < total ? cursor + MAP_PAGE_SIZE : null,
    trainers,
    features,
    priceMin,
    priceMax: rawMax > priceMin ? rawMax : priceMin + 1,
  };
}
