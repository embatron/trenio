import path from "node:path";

import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";

import {
  VISITOR_PLACE_COOKIE,
  VISITOR_PLACE_MAX_AGE,
  parseVisitorPlace,
  serializeVisitorPlace,
  type CatalogPlace,
  type VisitorPlace,
  type VisitorPoint,
} from "@/lib/catalog/visitor-place";

const MAX_ACCURACY_KM = 100;

const CITY_ALIASES: Record<string, string> = {
  minsk: "Минск",
  gomel: "Гомель",
  homyel: "Гомель",
  homiel: "Гомель",
  grodno: "Гродно",
  hrodna: "Гродно",
  brest: "Брест",
  vitebsk: "Витебск",
  viciebsk: "Витебск",
  mogilev: "Могилёв",
  mahilyow: "Могилёв",
  mahiliou: "Могилёв",
  bobruisk: "Бобруйск",
  bobruysk: "Бобруйск",
  babruysk: "Бобруйск",
  baranovichi: "Барановичи",
  baranavichy: "Барановичи",
  pinsk: "Пинск",
  orsha: "Орша",
  mozyr: "Мозырь",
  mazyr: "Мозырь",
  borisov: "Борисов",
  barysaw: "Борисов",
  lida: "Лида",
  polotsk: "Полоцк",
  polatsk: "Полоцк",
  novopolotsk: "Новополоцк",
  navapolatsk: "Новополоцк",
  soligorsk: "Солигорск",
  salihorsk: "Солигорск",
  molodechno: "Молодечно",
  maladzyechna: "Молодечно",
  zhlobin: "Жлобин",
  svetlogorsk: "Светлогорск",
  rechitsa: "Речица",
  slutsk: "Слуцк",
  zhodino: "Жодино",
  slonim: "Слоним",
  kobrin: "Кобрин",
  volkovysk: "Волковыск",
  smorgon: "Сморгонь",
};

type GeoModule = {
  lookup: (ip: string) => GeoHit | Promise<GeoHit | null> | null;
};

type GeoHit = {
  country?: string;
  city?: string;
  area?: string | number;
  latitude?: number;
  longitude?: number;
};

let geoModulePromise: Promise<GeoModule> | null = null;

function fold(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function canonicalCity(raw: string): string | null {
  const folded = fold(raw);
  if (!folded) return null;
  const direct = BELARUS_CITIES.find((name) => fold(name) === folded);
  if (direct) return direct;
  const alias = CITY_ALIASES[folded];
  if (!alias) return null;
  return BELARUS_CITIES.find((name) => fold(name) === fold(alias)) ?? null;
}

function accuracyKm(area: unknown): number | null {
  if (typeof area === "number" && Number.isFinite(area)) return area;
  if (typeof area === "string" && area.trim()) {
    const value = Number(area);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function isPublicIp(ip: string): boolean {
  const value = ip.trim().replace(/^::ffff:/i, "");
  if (!value || value.length > 64 || value === "unknown") return false;
  const lower = value.toLowerCase();
  if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return false;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return value.includes(":");
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  return a < 224;
}

function clientPublicIp(): string | null {
  let request: Request;
  try {
    request = getRequest();
  } catch {
    return null;
  }
  const candidates = [request.headers.get("cf-connecting-ip"), request.headers.get("x-real-ip")];
  for (const candidate of candidates) {
    const ip = candidate?.split(",")[0]?.trim() ?? "";
    if (isPublicIp(ip)) return ip;
  }
  return null;
}

function configureGeoEnv() {
  process.env.ILA_FIELDS = "country,city,area,latitude,longitude";
  process.env.ILA_LANGUAGE = "ru";
  process.env.ILA_SMALL_MEMORY = "true";
  process.env.ILA_SILENT = "true";
  process.env.ILA_DATA_DIR = path.join(process.cwd(), "data/geoip");
  process.env.ILA_TMP_DATA_DIR = path.join(process.cwd(), "data/geoip-tmp");
  process.env.ILA_LICENSE_KEY = process.env.ILA_LICENSE_KEY || "redist";
}

function geoModule() {
  if (!geoModulePromise) {
    configureGeoEnv();
    geoModulePromise = import("ip-location-api").then((mod) => mod as GeoModule);
  }
  return geoModulePromise;
}

function remember(place: VisitorPlace) {
  setCookie(VISITOR_PLACE_COOKIE, serializeVisitorPlace(place), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_PLACE_MAX_AGE,
  });
}

async function lookupHit(ip: string): Promise<GeoHit | null> {
  if (!isPublicIp(ip)) return null;
  const geo = await geoModule();
  const hit = await geo.lookup(ip);
  return hit ?? null;
}

function pointFromHit(hit: GeoHit | null): { lat: number; lng: number } | null {
  if (!hit) return null;
  const lat = Number(hit.latitude);
  const lng = Number(hit.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function detectBelarusCity(ip: string): Promise<string | null> {
  const hit = await lookupHit(ip);
  if (!hit || hit.country !== "BY" || typeof hit.city !== "string") return null;
  const accuracy = accuracyKm(hit.area);
  if (accuracy != null && accuracy > MAX_ACCURACY_KM) return null;
  return canonicalCity(hit.city);
}

async function detectPoint(ip: string): Promise<{ lat: number; lng: number } | null> {
  return pointFromHit(await lookupHit(ip));
}

function placeFromCity(city: string): CatalogPlace {
  remember({ cities: [city], query: "", dismissed: false, origin: "detected" });
  return { cities: [city], query: "", source: "detected", lookupOnClient: false };
}

export async function resolveVisitorPlace(): Promise<CatalogPlace> {
  const saved = parseVisitorPlace(getCookie(VISITOR_PLACE_COOKIE));
  if (saved?.dismissed) return { cities: [], query: "", source: "none", lookupOnClient: false };
  if (saved && (saved.cities.length > 0 || saved.query)) {
    return {
      cities: saved.cities,
      query: saved.query,
      source: saved.origin === "detected" ? "detected" : "saved",
      lookupOnClient: false,
    };
  }

  const ip = clientPublicIp();
  if (!ip) return { cities: [], query: "", source: "none", lookupOnClient: true };
  const city = await detectBelarusCity(ip);
  if (!city) return { cities: [], query: "", source: "none", lookupOnClient: false };
  return placeFromCity(city);
}

export async function detectVisitorPlace(clientIp: string): Promise<CatalogPlace> {
  const saved = parseVisitorPlace(getCookie(VISITOR_PLACE_COOKIE));
  if (saved?.dismissed) return { cities: [], query: "", source: "none", lookupOnClient: false };
  if (saved && (saved.cities.length > 0 || saved.query)) {
    return {
      cities: saved.cities,
      query: saved.query,
      source: saved.origin === "detected" ? "detected" : "saved",
      lookupOnClient: false,
    };
  }

  const ip = clientPublicIp() ?? clientIp;
  const city = await detectBelarusCity(ip);
  if (!city) return { cities: [], query: "", source: "none", lookupOnClient: false };
  return placeFromCity(city);
}

function pointResult(point: { lat: number; lng: number } | null, lookupOnClient: boolean): VisitorPoint {
  return {
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    lookupOnClient,
  };
}

/** IP coordinates for distance sorting. The place cookie still stores only the settlement name. */
export async function resolveVisitorPoint(): Promise<VisitorPoint> {
  const ip = clientPublicIp();
  if (!ip) return pointResult(null, true);
  return pointResult(await detectPoint(ip), false);
}

export async function detectVisitorPoint(clientIp: string): Promise<VisitorPoint> {
  const ip = clientPublicIp() ?? clientIp;
  if (!isPublicIp(ip)) return pointResult(null, false);
  return pointResult(await detectPoint(ip), false);
}
