/**
 * Nominatim does not read a Belarus street abbreviation.
 * The lookup expands it. The street stored on the profile is the one the geocoder returns.
 */
function abbreviations(): Array<[RegExp, string]> {
  return [
    [/(?<![\p{L}])(?:пр-кт|пр-т|просп)(?:\.|(?![\p{L}]))\s*/giu, "проспект "],
    [/(?<![\p{L}])праспект(?![\p{L}])/giu, "проспект"],
    [/(?<![\p{L}])пр(?:\.|(?![\p{L}]))\s*/giu, "проспект "],
    [/(?<![\p{L}])вуліца(?![\p{L}])/giu, "улица"],
    [/(?<![\p{L}])(?:вул|ул)(?:\.|(?![\p{L}]))\s*/giu, "улица "],
    [/(?<![\p{L}])завулак(?![\p{L}])/giu, "переулок"],
    [/(?<![\p{L}])пер(?:\.|(?![\p{L}]))\s*/giu, "переулок "],
    [/(?<![\p{L}])(?:бульв|б-р|бул)(?:\.|(?![\p{L}]))\s*/giu, "бульвар "],
    [/(?<![\p{L}])набярэжная(?![\p{L}])/giu, "набережная"],
    [/(?<![\p{L}])наб(?:\.|(?![\p{L}]))\s*/giu, "набережная "],
    [/(?<![\p{L}])плошча(?![\p{L}])/giu, "площадь"],
    [/(?<![\p{L}])пл(?:\.|(?![\p{L}]))\s*/giu, "площадь "],
    [/(?<![\p{L}])ш(?:\.|(?![\p{L}]))\s*/giu, "шоссе "],
    [/(?<![\p{L}])(?:мкр-н|мкр|м-н)\.?\s*/giu, "микрорайон "],
    [/(?<![\p{L}])(?:дом|д)\.?\s*(?=\d)/giu, ""],
    [/(?<![\p{L}])город(?![\p{L}])\s*/giu, ""],
    [/(?<![\p{L}])г\.\s*(?=\p{L})/giu, ""],
  ];
}

/** Belarusian street names Nominatim often indexes in Russian. */
function streetNameSynonyms(): Array<[RegExp, string]> {
  return [
    [/(?<![\p{L}])незалежнасці(?![\p{L}])/giu, "Независимости"],
    [/(?<![\p{L}])пераможцаў(?![\p{L}])/giu, "Победителей"],
    [/(?<![\p{L}])прытыцкага(?![\p{L}])/giu, "Притыцкого"],
    [/(?<![\p{L}])кальварыйская(?![\p{L}])/giu, "Кальварийская"],
    [/(?<![\p{L}])каліноўскага(?![\p{L}])/giu, "Калиновского"],
    [/(?<![\p{L}])сурганава(?![\p{L}])/giu, "Сурганова"],
  ];
}

const ADDRESS_STOP = new Set([
  "улица",
  "проспект",
  "переулок",
  "бульвар",
  "набережная",
  "площадь",
  "шоссе",
  "микрорайон",
  "беларусь",
  "беларуси",
  "город",
  "дома",
  "дом",
  "корпус",
  "строение",
]);

function collapse(value: string): string {
  return value
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/,\s*$/g, "")
    .replace(/^\s*,\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function foldAddress(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е");
}

export function expandStreetQuery(raw: string): string {
  let value = raw;
  for (const [pattern, replacement] of abbreviations()) {
    value = value.replace(pattern, replacement);
  }
  return collapse(value);
}

function cleanAddressNoise(raw: string): string {
  return collapse(
    raw
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, " ")
      .replace(/(?:\+?\s*375|80)(?:[\s().-]*\d){9}/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/(?<![\p{L}])(?:адрес|адрас)\s*[:\-—]?\s*/giu, " "),
  );
}

function stripBuildingTail(value: string): string {
  return value.replace(
    /(?<![\p{L}])(?:строение|корпус|корп|стр|литера|лит)\.?\s*\d+[а-яёa-z]?(?![\p{L}\d])/giu,
    " ",
  );
}

function glueHouseLetter(value: string): string {
  return value.replace(
    /(\d+)\s*[-–]?\s*([а-яёa-z])(?![\p{L}\d])/giu,
    (_, house: string, letter: string) => `${house}${letter.toLocaleUpperCase("ru")}`,
  );
}

function applyStreetSynonyms(value: string): string {
  let next = value;
  for (const [pattern, replacement] of streetNameSynonyms()) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

/**
 * Lookup attempts, most specific first.
 * A building suffix and a Belarusian street name are separate attempts.
 * At most four. The stored address is not one of these strings.
 */
export function addressLookupQueries(raw: string): string[] {
  const expanded = expandStreetQuery(cleanAddressNoise(raw));
  const primary = collapse(glueHouseLetter(stripBuildingTail(expanded)));
  const folded = primary.replace(/ё/gi, (char) => (char === "Ё" ? "Е" : "е"));
  const synonym = collapse(applyStreetSynonyms(primary));
  const withoutType = collapse(
    primary.replace(
      /(?<![\p{L}])(?:улица|проспект|переулок|бульвар|набережная|площадь|шоссе|микрорайон)(?![\p{L}])/giu,
      " ",
    ),
  );
  const queries: string[] = [];
  for (const candidate of [primary, folded, synonym, withoutType]) {
    const value = collapse(candidate);
    if (!sanitizeQuery(value)) continue;
    if (queries.some((item) => item.toLocaleLowerCase("ru") === value.toLocaleLowerCase("ru"))) continue;
    queries.push(value);
  }
  return queries;
}

function addressTokens(value: string): string[] {
  return foldAddress(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function houseNumbers(value: string): string[] {
  return [...foldAddress(value).matchAll(/(?<![\p{L}\d])(\d{1,4})(?![\d])/gu)].map((match) => match[1]);
}

/**
 * How well a Nominatim hit names the same street or place.
 * Zero means the hit is only the city, or a different street.
 */
export function addressHitScore(
  query: string,
  hit: { street: string; displayName: string; city: string },
): number {
  const ignore = new Set(ADDRESS_STOP);
  for (const token of addressTokens(hit.city)) ignore.add(token);
  const names = addressTokens(query).filter((token) => token.length >= 4 && !ignore.has(token) && !/^\d+$/.test(token));
  const hitNames = new Set(addressTokens(`${hit.street} ${hit.displayName}`).filter((token) => !ignore.has(token)));
  const nameHits = names.filter((token) => hitNames.has(token)).length;
  if (names.length > 0 && nameHits === 0) return 0;
  const wanted = houseNumbers(query);
  const found = new Set(houseNumbers(`${hit.street} ${hit.displayName}`));
  const numberHit = wanted.some((number) => found.has(number));
  if (names.length === 0 && !numberHit) return 0;
  return nameHits + (numberHit ? 3 : 0);
}

/** Trim and collapse whitespace. Queries shorter than 3 characters are rejected. */
export function sanitizeQuery(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed.length < 3 || collapsed.length > 200) return null;
  return collapsed;
}

/**
 * Cache key: lower case, punctuation removed, spaces collapsed.
 * Returns null when the sanitized query is empty or shorter than 3 characters.
 */
export function normalizeQuery(raw: string): string | null {
  const sanitized = sanitizeQuery(raw);
  if (!sanitized) return null;
  const stripped = sanitized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 3) return null;
  return stripped;
}
