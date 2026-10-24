/** Sidebar choices that stay when the visitor opens another category or city. */

const STORAGE_KEY = "trenio_catalog_filters";

const SORTS = ["popular", "rating", "reviews", "price-asc", "price-desc"] as const;
const EXPERIENCE = [1, 3, 5, 10] as const;

export type CatalogFilterMemory = {
  audience: "self" | "child" | null;
  formats: Array<"individual" | "group">;
  experience: number | null;
  sort: (typeof SORTS)[number];
  /** Null means the full price range of the current page. */
  price: { min: number; max: number } | null;
};

export const emptyCatalogFilters: CatalogFilterMemory = {
  audience: null,
  formats: [],
  experience: null,
  sort: "popular",
  price: null,
};

function isFormat(value: unknown): value is "individual" | "group" {
  return value === "individual" || value === "group";
}

export function readCatalogFilters(): CatalogFilterMemory {
  if (typeof window === "undefined") return emptyCatalogFilters;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCatalogFilters;
    const data = JSON.parse(raw) as Partial<CatalogFilterMemory>;
    const audience = data.audience === "self" || data.audience === "child" ? data.audience : null;
    const formats = Array.isArray(data.formats) ? data.formats.filter(isFormat).slice(0, 2) : [];
    const experience = EXPERIENCE.includes(data.experience as (typeof EXPERIENCE)[number]) ? data.experience ?? null : null;
    const sort = SORTS.includes(data.sort as (typeof SORTS)[number]) ? data.sort ?? "popular" : "popular";
    const price = data.price
      && typeof data.price.min === "number"
      && typeof data.price.max === "number"
      && data.price.max > data.price.min
      ? { min: data.price.min, max: data.price.max }
      : null;
    return { audience, formats, experience, sort, price };
  } catch {
    return emptyCatalogFilters;
  }
}

export function writeCatalogFilters(next: CatalogFilterMemory) {
  if (typeof window === "undefined") return;
  const empty = next.audience == null
    && next.formats.length === 0
    && next.experience == null
    && next.sort === "popular"
    && next.price == null;
  if (empty) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearCatalogFilters() {
  writeCatalogFilters(emptyCatalogFilters);
}
