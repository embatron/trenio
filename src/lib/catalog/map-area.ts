import { and, avg, count, eq, inArray, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { catalogCategorySports, catalogSportById } from "@/lib/catalog/catalog-sports";
import type { MapAreaInput } from "@/lib/catalog/map-area-input";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import type { TrainerAudience, TrainerFormat } from "@/lib/catalog/published-trainers";
import { trainerNameParts } from "@/lib/catalog/trainer-name";
import { mapFrameCities } from "@/lib/catalog/map-city";
import { isSpecificAddress, placesFromProfile, SPECIFIC_ADDRESS_SQL } from "@/lib/geo/schemas";
import { MAP_CLUSTER_CAP, MAP_PAGE_SIZE, MAP_PIN_CAP, MAP_TOOLTIP_CAP, mapClusterStep } from "@/lib/catalog/map-limits";

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
  unlocatedCity: string | null;
  unlocatedTotal: number;
  unlocated: MapTrainer[];
  unlocatedNextCursor: number | null;
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

function jsonList(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

function slugList(value: unknown): string[] {
  if (Array.isArray(value)) return jsonList(value);
  if (typeof value !== "string" || value.length < 2 || !value.startsWith("{")) return [];
  const body = value.slice(1, -1);
  if (!body) return [];
  return body.split(",").flatMap((item) => {
    const slug = item.trim().replace(/^"|"$/g, "");
    return slug ? [slug] : [];
  });
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
    WITH mapped AS (
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
      AND coalesce(address, '') ~* ${SPECIFIC_ADDRESS_SQL}
      AND ${citySql}
      AND ${boundsWhere(bounds)}
    )
    SELECT slug, price_from, lat, lng, city, address FROM mapped
  `;
}

function withoutSpecificAddress(cities: string[]): SQL {
  return sql`
    lower(replace(btrim(tp.city), 'ё', 'е')) IN (${inList(cities.map((city) => foldCity(city)))})
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(tp.training_places) = 'array' THEN tp.training_places ELSE '[]'::jsonb END
      ) AS place
      WHERE coalesce(place->>'address', '') ~* ${SPECIFIC_ADDRESS_SQL}
    )
    AND coalesce(tp.address, '') !~* ${SPECIFIC_ADDRESS_SQL}
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
}, places?: MapTrainerPlace[]): MapTrainer | null {
  const stored = placesFromProfile(row);
  const specific = stored.flatMap((place) => {
    if (!isSpecificAddress(place.address)) return [];
    if (place.geocodeStatus !== "ok" || place.lat == null || place.lng == null) return [];
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return [];
    return [{ city: place.city, address: place.address, lat: place.lat, lng: place.lng }];
  });
  const located = places ?? specific;
  if (places === undefined && located.length === 0) return null;
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
    places: located,
  };
}

function inFrame(lat: number, lng: number, bounds: AreaBounds) {
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.world) return true;
  if (bounds.wraps) return lng >= bounds.west || lng <= bounds.east;
  return lng >= bounds.west && lng <= bounds.east;
}

async function loadTrainers(slugs: string[], bounds: AreaBounds | null, cityName: string) {
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
    if (!bounds) {
      const trainer = toMapTrainer(row, []);
      if (trainer) bySlug.set(trainer.slug, trainer);
      continue;
    }
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
    WITH places AS MATERIALIZED (${placesSql(filters, bounds, true)})
    SELECT
      round(lat::numeric, 5) AS lat_key,
      round(lng::numeric, 5) AS lng_key,
      min(lat) AS lat,
      min(lng) AS lng,
      min(city) AS city,
      min(address) AS address,
      count(DISTINCT slug)::int AS count,
      (array_agg(DISTINCT slug ORDER BY slug))[1:${SLUG_CAP}] AS slugs
    FROM places
    GROUP BY 1, 2
    ORDER BY count DESC
    LIMIT ${MAP_PIN_CAP}
  `);
  const slugsByKey = new Map<string, string[]>();
  for (const row of groups) {
    const lat = Number(Number(row.lat_key).toFixed(5));
    const lng = Number(Number(row.lng_key).toFixed(5));
    slugsByKey.set(pinKey(lat, lng), slugList(row.slugs).slice(0, SLUG_CAP));
  }
  const sampleSlugs = [...new Set([...slugsByKey.values()].flatMap((list) => list.slice(0, MAP_TOOLTIP_CAP)))];
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
      trainers: slugs.slice(0, MAP_TOOLTIP_CAP).flatMap((slug) => {
        const trainer = bySlug.get(slug);
        return trainer ? [cardOf(trainer)] : [];
      }),
    }];
  });
}

async function clusterFeatures(filters: AreaFilters, bounds: AreaBounds, zoom: number): Promise<MapAreaFeature[]> {
  const steps = Array.from({ length: 6 }, (_, attempt) => mapClusterStep(zoom, attempt));
  const branches = steps.map((step, attempt) => sql`
    SELECT
      ${attempt}::int AS attempt,
      round((lat / ${step})::numeric) AS gy,
      round((lng / ${step})::numeric) AS gx,
      avg(lat) AS lat,
      avg(lng) AS lng,
      count(DISTINCT slug)::int AS count
    FROM places
    GROUP BY 2, 3
  `);
  const rows = await queryRows(sql`
    WITH places AS MATERIALIZED (${placesSql(filters, bounds, true)})
    ${sql.join(branches, sql` UNION ALL `)}
  `);
  let chosen = steps.length - 1;
  for (let attempt = 0; attempt < steps.length; attempt += 1) {
    const size = rows.reduce((count, row) => count + (num(row.attempt) === attempt ? 1 : 0), 0);
    if (size <= MAP_CLUSTER_CAP) {
      chosen = attempt;
      break;
    }
  }
  const step = steps[chosen];
  return rows
    .filter((row) => num(row.attempt) === chosen)
    .sort((a, b) => num(b.count) - num(a.count))
    .slice(0, MAP_CLUSTER_CAP)
    .flatMap((row) => {
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

async function citiesInFrame(filters: AreaFilters, bounds: AreaBounds): Promise<string[]> {
  if (filters.city.trim()) return mapFrameCities(filters.city, bounds);
  const rows = await queryRows(sql`
    WITH places AS (${placesSql(filters, bounds, true)})
    SELECT btrim(tp.city) AS city
    FROM places
    JOIN trainer_profiles tp ON tp.slug = places.slug
    GROUP BY 1
  `);
  const pins = rows.flatMap((row) => (typeof row.city === "string" ? [row.city] : []));
  return mapFrameCities("", bounds, pins);
}

async function frameSnapshot(filters: AreaFilters, bounds: AreaBounds, cursor: number) {
  const clat = (bounds.south + bounds.north) / 2;
  const clng = bounds.world || bounds.wraps ? 0 : (bounds.west + bounds.east) / 2;
  const rows = await queryRows(sql`
    WITH places AS MATERIALIZED (${placesSql(filters, bounds, true)})
    SELECT
      (SELECT count(*)::int FROM places) AS places,
      (SELECT count(DISTINCT slug)::int FROM places) AS trainers,
      (SELECT count(DISTINCT (round(lat::numeric, 5)::text || ',' || round(lng::numeric, 5)::text))::int FROM places) AS points,
      (
        SELECT coalesce(json_agg(city), '[]'::json)
        FROM (
          SELECT btrim(tp.city) AS city
          FROM places
          JOIN trainer_profiles tp ON tp.slug = places.slug
          GROUP BY 1
        ) cities
      ) AS cities,
      (
        SELECT coalesce(json_agg(page.slug ORDER BY page.dist, page.slug), '[]'::json)
        FROM (
          SELECT slug,
            min(((lat - ${clat}) * (lat - ${clat})) + ((lng - ${clng}) * (lng - ${clng}))) AS dist
          FROM places
          GROUP BY slug
          ORDER BY dist, slug
          LIMIT ${MAP_PAGE_SIZE} OFFSET ${cursor}
        ) page
      ) AS page
  `);
  const row = rows[0] ?? {};
  return {
    places: num(row.places),
    trainers: num(row.trainers),
    points: num(row.points),
    cities: jsonList(row.cities),
    slugs: jsonList(row.page),
  };
}

async function unlocatedPage(filters: AreaFilters, cities: string[], cursor: number) {
  if (cities.length === 0) return { city: null, total: 0, trainers: [] as MapTrainer[], next: null as number | null };
  const where = sql`${profileWhere(filters, true)} AND ${withoutSpecificAddress(cities)}`;
  const pageRows = await queryRows(sql`
    SELECT tp.slug, count(*) OVER ()::int AS total
    FROM trainer_profiles tp
    WHERE ${where}
    ORDER BY tp.last_name, tp.first_name, tp.slug
    LIMIT ${MAP_PAGE_SIZE} OFFSET ${cursor}
  `);
  const total = pageRows.length > 0 ? num(pageRows[0]?.total) : 0;
  const slugs = pageRows.flatMap((row) => (typeof row.slug === "string" ? [row.slug] : []));
  return {
    city: cities[0] ?? null,
    total,
    trainers: await loadTrainers(slugs, null, cities[0] ?? ""),
    next: cursor + slugs.length < total ? cursor + MAP_PAGE_SIZE : null,
  };
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
  if (input.list === "unlocated") {
    const cities = await citiesInFrame(filters, bounds);
    const page = await unlocatedPage(filters, cities, cursor);
    return {
      total: 0,
      addressCount: 0,
      matched: 0,
      nextCursor: null,
      trainers: [],
      features: [],
      priceMin: 0,
      priceMax: 1,
      unlocatedCity: page.city,
      unlocatedTotal: page.total,
      unlocated: page.trainers,
      unlocatedNextCursor: page.next,
    };
  }
  const includeFeatures = input.includeFeatures !== false && cursor === 0;
  const meta = input.meta !== false && cursor === 0;
  const spanFilters: AreaFilters = { ...filters, audience: null, formats: [], minExperience: null, priceMin: null, priceMax: null };
  const [shot, spanRows, matchedRows] = await Promise.all([
    frameSnapshot(filters, bounds, cursor),
    meta
      ? queryRows(sql`
        WITH places AS MATERIALIZED (${placesSql(spanFilters, null, false)})
        SELECT
          coalesce(min(price_from), 0)::int AS price_min,
          coalesce(max(price_from), 0)::int AS price_max
        FROM places
      `)
      : Promise.resolve([]),
    meta
      ? queryRows(sql`
        WITH places AS MATERIALIZED (${placesSql(filters, null, true)})
        SELECT count(DISTINCT slug)::int AS matched
        FROM places
      `)
      : Promise.resolve([]),
  ]);
  const total = shot.trainers;
  const addressCount = shot.places;
  const points = shot.points;
  const cities = mapFrameCities(filters.city, bounds, filters.city.trim() ? [] : shot.cities);
  const [trainers, loose, features] = await Promise.all([
    loadTrainers(shot.slugs, bounds, filters.city),
    cursor === 0 ? unlocatedPage(filters, cities, 0) : Promise.resolve(null),
    includeFeatures
      ? points > MAP_PIN_CAP
        ? clusterFeatures(filters, bounds, input.zoom)
        : pinFeatures(filters, bounds)
      : Promise.resolve([] as MapAreaFeature[]),
  ]);
  const priceMin = meta ? num(spanRows[0]?.price_min) : 0;
  const rawMax = meta ? num(spanRows[0]?.price_max) : 0;
  return {
    total,
    addressCount,
    matched: meta ? num(matchedRows[0]?.matched) : total,
    nextCursor: cursor + shot.slugs.length < total ? cursor + MAP_PAGE_SIZE : null,
    trainers,
    features,
    priceMin,
    priceMax: rawMax > priceMin ? rawMax : priceMin + 1,
    unlocatedCity: loose?.city ?? null,
    unlocatedTotal: loose?.total ?? 0,
    unlocated: loose?.trainers ?? [],
    unlocatedNextCursor: loose?.next ?? null,
  };
}
