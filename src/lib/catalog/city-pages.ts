/** Public city catalog pages. Slugs stay short and stable; locative is for the H1. */

const CITY_PAGES = [
  { slug: "minsk", name: "Минск", locative: "Минске" },
  { slug: "gomel", name: "Гомель", locative: "Гомеле" },
  { slug: "grodno", name: "Гродно", locative: "Гродно" },
  { slug: "vitebsk", name: "Витебск", locative: "Витебске" },
  { slug: "mogilev", name: "Могилёв", locative: "Могилёве" },
  { slug: "brest", name: "Брест", locative: "Бресте" },
  { slug: "bobruisk", name: "Бобруйск", locative: "Бобруйске" },
  { slug: "baranovichi", name: "Барановичи", locative: "Барановичах" },
  { slug: "borisov", name: "Борисов", locative: "Борисове" },
  { slug: "pinsk", name: "Пинск", locative: "Пинске" },
  { slug: "mozyr", name: "Мозырь", locative: "Мозыре" },
  { slug: "lida", name: "Лида", locative: "Лиде" },
  { slug: "orsha", name: "Орша", locative: "Орше" },
  { slug: "soligorsk", name: "Солигорск", locative: "Солигорске" },
  { slug: "novopolotsk", name: "Новополоцк", locative: "Новополоцке" },
  { slug: "molodechno", name: "Молодечно", locative: "Молодечно" },
  { slug: "polotsk", name: "Полоцк", locative: "Полоцке" },
  { slug: "zhlobin", name: "Жлобин", locative: "Жлобине" },
  { slug: "rechitsa", name: "Речица", locative: "Речице" },
  { slug: "zhodino", name: "Жодино", locative: "Жодино" },
] as const;

export type CityCatalogPage = (typeof CITY_PAGES)[number];

export function cityCatalogBySlug(slug: string): CityCatalogPage | null {
  return CITY_PAGES.find((city) => city.slug === slug) ?? null;
}

export function cityCatalogSlug(name: string): string | null {
  return CITY_PAGES.find((city) => city.name === name)?.slug ?? null;
}

export function listCityCatalogPages(): CityCatalogPage[] {
  return [...CITY_PAGES];
}
