import { cityCatalogBySlug } from "@/lib/catalog/city-pages";

/** Locative after «в»: «Минске», or «городе Слуцк» when the city has no catalog page. */
export function cityIn(slug: string, label: string) {
  return cityCatalogBySlug(slug)?.locative ?? `городе ${label}`;
}

export function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Snippet length. Prefer a finished sentence over a cut word. */
export function clipMeta(text: string, max = 170) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const sentence = slice.lastIndexOf(". ");
  if (sentence >= 80) return slice.slice(0, sentence + 1).trim();
  const space = slice.lastIndexOf(" ");
  const cut = (space > 80 ? slice.slice(0, space) : slice).replace(/[.,;: ]+$/g, "");
  return `${cut}…`;
}

export function bynAmount(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*BYN$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}
