/** Public city catalog pages. Slugs stay short and stable; locative is for the H1.
 * `lat` and `lng` are the city center used when the map opens from that page. */

const CITY_PAGES = [
  { slug: "minsk", name: "Минск", locative: "Минске", lat: 53.9006, lng: 27.559 },
  { slug: "gomel", name: "Гомель", locative: "Гомеле", lat: 52.4345, lng: 30.9754 },
  { slug: "grodno", name: "Гродно", locative: "Гродно", lat: 53.6694, lng: 23.8131 },
  { slug: "vitebsk", name: "Витебск", locative: "Витебске", lat: 55.1904, lng: 30.2049 },
  { slug: "mogilev", name: "Могилёв", locative: "Могилёве", lat: 53.9007, lng: 30.3314 },
  { slug: "brest", name: "Брест", locative: "Бресте", lat: 52.0976, lng: 23.7341 },
  { slug: "bobruisk", name: "Бобруйск", locative: "Бобруйске", lat: 53.1384, lng: 29.2214 },
  { slug: "baranovichi", name: "Барановичи", locative: "Барановичах", lat: 53.1327, lng: 26.0139 },
  { slug: "borisov", name: "Борисов", locative: "Борисове", lat: 54.2279, lng: 28.505 },
  { slug: "pinsk", name: "Пинск", locative: "Пинске", lat: 52.1229, lng: 26.0951 },
  { slug: "mozyr", name: "Мозырь", locative: "Мозыре", lat: 52.0495, lng: 29.2456 },
  { slug: "lida", name: "Лида", locative: "Лиде", lat: 53.8884, lng: 25.2997 },
  { slug: "orsha", name: "Орша", locative: "Орше", lat: 54.5081, lng: 30.4172 },
  { slug: "soligorsk", name: "Солигорск", locative: "Солигорске", lat: 52.7876, lng: 27.5415 },
  { slug: "novopolotsk", name: "Новополоцк", locative: "Новополоцке", lat: 55.5318, lng: 28.5987 },
  { slug: "molodechno", name: "Молодечно", locative: "Молодечно", lat: 54.3146, lng: 26.8446 },
  { slug: "polotsk", name: "Полоцк", locative: "Полоцке", lat: 55.4856, lng: 28.7684 },
  { slug: "zhlobin", name: "Жлобин", locative: "Жлобине", lat: 52.8926, lng: 30.024 },
  { slug: "rechitsa", name: "Речица", locative: "Речице", lat: 52.3617, lng: 30.3919 },
  { slug: "zhodino", name: "Жодино", locative: "Жодино", lat: 54.0985, lng: 28.3325 },
] as const;

export type CityCatalogPage = (typeof CITY_PAGES)[number];

export function cityCatalogBySlug(slug: string): CityCatalogPage | null {
  return CITY_PAGES.find((city) => city.slug === slug) ?? null;
}

export function cityCatalogSlug(name: string): string | null {
  return cityCatalogByName(name)?.slug ?? null;
}

function foldCityName(name: string) {
  return name.trim().toLowerCase().replaceAll("ё", "е");
}

/** City page by the settlement name, ignoring case and ё. */
export function cityCatalogByName(name: string): CityCatalogPage | null {
  const folded = foldCityName(name);
  if (!folded) return null;
  return CITY_PAGES.find((city) => foldCityName(city.name) === folded) ?? null;
}

export function listCityCatalogPages(): CityCatalogPage[] {
  return [...CITY_PAGES];
}
