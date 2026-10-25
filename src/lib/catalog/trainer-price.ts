import { createServerFn } from "@tanstack/react-start";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";

export const NEGOTIABLE_PRICE_LABEL = "договорная";

export type TrainerPriceMap = Record<string, number | null>;

export function statedTrainerPrice(price: number | null | undefined): number | null {
  if (typeof price === "number" && Number.isInteger(price) && price >= 1) return price;
  return null;
}

/** A saved profile uses its own price, including an empty one. */
export function priceForCard(slug: string, fallback: number, prices: TrainerPriceMap): number | null {
  if (Object.prototype.hasOwnProperty.call(prices, slug)) return statedTrainerPrice(prices[slug]);
  return statedTrainerPrice(fallback);
}

export function compareTrainerPrice(a: number | null, b: number | null, direction: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export const listTrainerPricesFn = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb()
    .select({ slug: trainerProfiles.slug, priceFrom: trainerProfiles.priceFrom })
    .from(trainerProfiles);
  const prices: TrainerPriceMap = {};
  for (const row of rows) prices[row.slug] = statedTrainerPrice(row.priceFrom);
  return prices;
});
