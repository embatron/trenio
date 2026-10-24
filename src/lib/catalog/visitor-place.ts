import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const VISITOR_PLACE_COOKIE = "trenio_place";
export const VISITOR_PLACE_MAX_AGE = 60 * 60 * 24 * 365;

export type VisitorPlace = {
  cities: string[];
  query: string;
  dismissed: boolean;
  origin: "detected" | "chosen";
};

export type CatalogPlace = {
  cities: string[];
  query: string;
  source: "detected" | "saved" | "none";
  /** Request had no public IP, so the browser should send its own for a lookup. */
  lookupOnClient: boolean;
};

export const emptyCatalogPlace: CatalogPlace = {
  cities: [],
  query: "",
  source: "none",
  lookupOnClient: false,
};

/** Coordinates from the local GeoLite2 lookup. Not written to the place cookie. */
export type VisitorPoint = {
  lat: number | null;
  lng: number | null;
  lookupOnClient: boolean;
};

export const emptyVisitorPoint: VisitorPoint = {
  lat: null,
  lng: null,
  lookupOnClient: false,
};

export function serializeVisitorPlace(place: VisitorPlace): string {
  return JSON.stringify({
    c: place.cities
      .map((city) => city.trim())
      .filter(Boolean)
      .slice(0, 6),
    q: place.query.trim().slice(0, 80),
    d: place.dismissed ? 1 : 0,
    o: place.origin === "detected" ? "d" : "c",
  });
}

export function parseVisitorPlace(raw: string | null | undefined): VisitorPlace | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;
  try {
    if (text.includes("%")) text = decodeURIComponent(text);
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(text) as { c?: unknown; q?: unknown; d?: unknown; o?: unknown };
    const cities = Array.isArray(data.c)
      ? data.c
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 80))
          .slice(0, 6)
      : [];
    const query = typeof data.q === "string" ? data.q.trim().slice(0, 80) : "";
    return {
      cities,
      query,
      dismissed: data.d === 1,
      origin: data.o === "d" ? "detected" : "chosen",
    };
  } catch {
    return null;
  }
}

export function writeVisitorPlace(place: VisitorPlace) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${VISITOR_PLACE_COOKIE}=${encodeURIComponent(serializeVisitorPlace(place))}; Path=/; Max-Age=${VISITOR_PLACE_MAX_AGE}; SameSite=Lax${secure}`;
}

export const resolveVisitorPlaceFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogPlace> => {
    try {
      const { resolveVisitorPlace } = await import("./visitor-place.server");
      return await resolveVisitorPlace();
    } catch (error) {
      console.error(error);
      return emptyCatalogPlace;
    }
  },
);

const clientIpSchema = z.object({
  ip: z.string().trim().max(64),
});

export const detectVisitorPlaceFn = createServerFn({ method: "POST" })
  .validator(clientIpSchema)
  .handler(async ({ data }): Promise<CatalogPlace> => {
    try {
      const { detectVisitorPlace } = await import("./visitor-place.server");
      return await detectVisitorPlace(data.ip);
    } catch (error) {
      console.error(error);
      return emptyCatalogPlace;
    }
  });

export const resolveVisitorPointFn = createServerFn({ method: "GET" }).handler(async (): Promise<VisitorPoint> => {
  try {
    const { resolveVisitorPoint } = await import("./visitor-place.server");
    return await resolveVisitorPoint();
  } catch (error) {
    console.error(error);
    return emptyVisitorPoint;
  }
});

export const detectVisitorPointFn = createServerFn({ method: "POST" })
  .validator(clientIpSchema)
  .handler(async ({ data }): Promise<VisitorPoint> => {
    try {
      const { detectVisitorPoint } = await import("./visitor-place.server");
      return await detectVisitorPoint(data.ip);
    } catch (error) {
      console.error(error);
      return emptyVisitorPoint;
    }
  });
