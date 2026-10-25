import { z } from "zod";

export const GEOCODE_STATUSES = ["ok", "not_found", "pending"] as const;
export type GeocodeStatus = (typeof GEOCODE_STATUSES)[number];

export function asGeocodeStatus(value: string | null | undefined): GeocodeStatus | null {
  if (value === "ok" || value === "not_found" || value === "pending") return value;
  return null;
}

export const MAX_TRAINING_PLACES = 3;
export const BELARUS_COUNTRY = "Беларусь";
export const FOREIGN_ADDRESS_MESSAGE = "Адрес должен быть в Беларуси. Адреса других стран не сохраняются.";

export type AddressSuggestion = {
  displayName: string;
  city: string;
  district: string;
  street: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
};

function addressParts(displayName: string) {
  return displayName.split(",").map((part) => part.trim()).filter(Boolean);
}

export function suggestionLines(hit: AddressSuggestion): { main: string; meta: string } {
  const street = hit.street.trim();
  const display = hit.displayName.trim();
  const parts = addressParts(display);
  const region = hit.region.trim() || parts.find((part) => /область/i.test(part)) || "";
  const country = hit.country.trim() || parts.find((part) => /беларус/i.test(part)) || "Беларусь";
  const city = hit.city.trim();
  const main = street && street !== display
    ? street
    : parts.filter((part) => part !== region && part !== country && part.toLowerCase() !== city.toLowerCase() && !/район|^\d{5,6}$/i.test(part)).slice(0, 2).join(", ");
  const meta = [region, city, country].filter((part, index, all) => part && all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index).join(", ");
  return { main: main || display, meta };
}

export type TrainerPlace = {
  city: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geocodeStatus: GeocodeStatus | null;
};

export const EMPTY_TRAINER_PLACE: TrainerPlace = {
  city: "",
  district: "",
  address: "",
  lat: null,
  lng: null,
  geocodeStatus: null,
};

export function placeLine(place: { city: string; district: string; address: string }) {
  return [place.city, place.address].map((part) => part.trim()).filter(Boolean).join(", ");
}

export function placeHasText(place: { city: string; district: string; address: string }) {
  return Boolean(place.city.trim() || place.district.trim() || place.address.trim());
}

export function readTrainingPlaces(value: unknown): TrainerPlace[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TRAINING_PLACES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<TrainerPlace>;
    const place: TrainerPlace = {
      city: typeof row.city === "string" ? row.city : "",
      district: typeof row.district === "string" ? row.district : "",
      address: typeof row.address === "string" ? row.address : "",
      lat: typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null,
      lng: typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null,
      geocodeStatus: asGeocodeStatus(typeof row.geocodeStatus === "string" ? row.geocodeStatus : null),
    };
    return placeHasText(place) ? [place] : [];
  });
}

export function placesFromProfile(row: {
  trainingPlaces?: unknown;
  address?: string | null;
  addressLat?: number | null;
  addressLng?: number | null;
  geocodeStatus?: string | null;
}): TrainerPlace[] {
  const stored = readTrainingPlaces(row.trainingPlaces);
  if (stored.length > 0) return stored;
  const address = row.address?.trim() ?? "";
  if (!address) return [];
  return [{
    city: "",
    district: "",
    address,
    lat: row.addressLat ?? null,
    lng: row.addressLng ?? null,
    geocodeStatus: asGeocodeStatus(row.geocodeStatus),
  }];
}

const placeInputSchema = z.object({
  city: z.string().trim().max(120),
  district: z.string().trim().max(120),
  address: z.string().trim().max(200),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
}).superRefine((place, ctx) => {
  if (place.lat != null && (place.lat < -90 || place.lat > 90)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lat"], message: "Широта должна быть от -90 до 90." });
  }
  if (place.lng != null && (place.lng < -180 || place.lng > 180)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lng"], message: "Долгота должна быть от -180 до 180." });
  }
});

export const placesShape = {
  places: z.array(placeInputSchema).max(MAX_TRAINING_PLACES),
};

export const suggestAddressSchema = z.object({
  query: z.string().trim().min(3).max(200),
});
