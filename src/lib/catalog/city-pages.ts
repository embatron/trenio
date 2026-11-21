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
  { slug: "svetlogorsk", name: "Светлогорск", locative: "Светлогорске", lat: 52.633, lng: 29.7484 },
  { slug: "slutsk", name: "Слуцк", locative: "Слуцке", lat: 53.0277, lng: 27.552 },
  { slug: "kobrin", name: "Кобрин", locative: "Кобрине", lat: 52.2086, lng: 24.3543 },
  { slug: "slonim", name: "Слоним", locative: "Слониме", lat: 53.0927, lng: 25.3193 },
  { slug: "volkovysk", name: "Волковыск", locative: "Волковыске", lat: 53.1647, lng: 24.4582 },
  { slug: "kalinkovichi", name: "Калинковичи", locative: "Калинковичах", lat: 52.1286, lng: 29.3314 },
  { slug: "smargon", name: "Смаргонь", locative: "Смаргони", lat: 54.4818, lng: 26.4013 },
  { slug: "rogachev", name: "Рогачёв", locative: "Рогачёве", lat: 53.082, lng: 30.0532 },
  { slug: "dzerzhinsk", name: "Дзержинск", locative: "Дзержинске", lat: 53.6852, lng: 27.1315 },
  { slug: "osipovichi", name: "Осиповичи", locative: "Осиповичах", lat: 53.3085, lng: 28.6382 },
  { slug: "gorki", name: "Горки", locative: "Горках", lat: 54.2895, lng: 30.9811 },
  { slug: "bereza", name: "Берёза", locative: "Берёзе", lat: 52.5346, lng: 24.9845 },
  { slug: "novogrudok", name: "Новогрудок", locative: "Новогрудке", lat: 53.5942, lng: 25.8216 },
  { slug: "vileyka", name: "Вилейка", locative: "Вилейке", lat: 54.4881, lng: 26.9145 },
  { slug: "smolevichi", name: "Смолевичи", locative: "Смолевичах", lat: 54.0299, lng: 28.0898 },
  { slug: "luninets", name: "Лунинец", locative: "Лунинце", lat: 52.2452, lng: 26.7978 },
  { slug: "krichev", name: "Кричев", locative: "Кричеве", lat: 53.6952, lng: 31.7066 },
  { slug: "ivatsevichi", name: "Ивацевичи", locative: "Ивацевичах", lat: 52.7091, lng: 25.3386 },
  { slug: "marina-gorka", name: "Марьина Горка", locative: "Марьиной Горке", lat: 53.5117, lng: 28.1478 },
  { slug: "pruzhany", name: "Пружаны", locative: "Пружанах", lat: 52.5582, lng: 24.4567 },
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

/** Twelve largest catalog cities, largest first. The mega menu shows them as two fixed columns of six. */
export function menuTopCityColumns(): [CityCatalogPage[], CityCatalogPage[]] {
  const top = CITY_PAGES.slice(0, 12);
  return [top.slice(0, 6), top.slice(6, 12)];
}
