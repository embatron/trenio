/**
 * Nominatim misses a Belarus address when the street type is abbreviated,
 * the city is repeated, the house letter is a Latin look-alike, or a corpus
 * marker is glued to the house number. The lookup sends a short canonical
 * query. The street stored on the profile is the one the geocoder returns.
 */
import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";

const STREET_TYPES = [
  "проспект",
  "улица",
  "переулок",
  "бульвар",
  "набережная",
  "площадь",
  "шоссе",
  "проезд",
  "тупик",
  "тракт",
  "микрорайон",
] as const;

type StreetType = (typeof STREET_TYPES)[number];

const TYPE_TITLE: Record<StreetType, string> = {
  проспект: "Проспект",
  улица: "Улица",
  переулок: "Переулок",
  бульвар: "Бульвар",
  набережная: "Набережная",
  площадь: "Площадь",
  шоссе: "Шоссе",
  проезд: "Проезд",
  тупик: "Тупик",
  тракт: "Тракт",
  микрорайон: "Микрорайон",
};

/** A hit can name the same street in Belarusian. */
const TYPE_ALIASES: Record<string, StreetType> = {
  праспект: "проспект",
  вуліца: "улица",
  уліца: "улица",
  завулак: "переулок",
  набярэжная: "набережная",
  плошча: "площадь",
  шаша: "шоссе",
  праезд: "проезд",
};

const ADDRESS_STOP = new Set<string>([
  ...STREET_TYPES,
  ...Object.keys(TYPE_ALIASES),
  "беларусь",
  "беларуси",
  "беларусі",
  "belarus",
  "город",
  "дома",
  "дом",
  "корпус",
  "строение",
]);

const NOISE_WORDS = new Set([
  "бассейн",
  "аквапарк",
  "спортзал",
  "фитнес",
  "школа",
  "фоц",
  "сш",
  "фк",
  "район",
  "фрунзенский",
  "центральный",
  "советский",
  "первомайский",
  "партизанский",
  "заводской",
  "ленинский",
  "московский",
  "октябрьский",
]);

/** House letter as written in Belarus: Cyrillic, even when the key was Latin. */
const HOUSE_LETTER: Record<string, string> = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
};

const LATIN_CITIES: Record<string, string> = {
  minsk: "Минск",
  gomel: "Гомель",
  grodno: "Гродно",
  hrodna: "Гродно",
  vitebsk: "Витебск",
  mogilev: "Могилев",
  mahiliou: "Могилёв",
  brest: "Брест",
};

const DIGRAPHS: Array<[string, string]> = [
  ["shch", "щ"],
  ["sch", "щ"],
  ["yo", "ё"],
  ["zh", "ж"],
  ["kh", "х"],
  ["ts", "ц"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ye", "е"],
  ["aya", "ая"],
  ["iya", "ия"],
  ["iy", "ий"],
  ["ey", "ей"],
  ["oy", "ой"],
  ["ay", "ай"],
  ["yy", "ый"],
  ["uy", "уй"],
];

const LATIN_LETTER: Record<string, string> = {
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
  c: "ц",
  y: "й",
  w: "в",
  q: "к",
  x: "кс",
};

function abbreviations(): Array<[RegExp, string]> {
  return [
    // Hyphenated tokens stay intact even when the street name is glued on.
    [/(?<![\p{L}])пр-кт\.?/giu, "проспект "],
    [/(?<![\p{L}])пр-т\.?/giu, "проспект "],
    [/(?<![\p{L}])п-т\.?/giu, "проспект "],
    [/(?<![\p{L}])пр\s*\.\s*т\.?/giu, "проспект "],
    [/(?<![\p{L}])пр\s+т(?![\p{L}])/giu, "проспект "],
    [/(?<![\p{L}])(?:просп|прасп)(?:\.|(?![\p{L}]))\s*/giu, "проспект "],
    [/(?<![\p{L}])праспект(?![\p{L}])/giu, "проспект"],
    [/(?<![\p{L}])пр-д\.?/giu, "проезд "],
    [/(?<![\p{L}])праезд(?![\p{L}])/giu, "проезд"],
    [/(?<![\p{L}])пр(?:\.|(?![\p{L}]))\s*/giu, "проспект "],
    [/(?<![\p{L}])(?:вуліца|уліца)(?![\p{L}])/giu, "улица"],
    [/(?<![\p{L}])(?:вул|ул)(?:\.|(?![\p{L}]))\s*/giu, "улица "],
    [/(?<![\p{L}])завулак(?![\p{L}])/giu, "переулок"],
    [/(?<![\p{L}])переул(?:\.|(?![\p{L}]))\s*/giu, "переулок "],
    [/(?<![\p{L}])пер(?:\.|(?![\p{L}]))\s*/giu, "переулок "],
    [/(?<![\p{L}])бульв(?:\.|(?![\p{L}]))\s*/giu, "бульвар "],
    [/(?<![\p{L}])б-р\.?/giu, "бульвар "],
    [/(?<![\p{L}])бул(?:\.|(?![\p{L}]))\s*/giu, "бульвар "],
    [/(?<![\p{L}])набярэжная(?![\p{L}])/giu, "набережная"],
    [/(?<![\p{L}])наб(?:\.|(?![\p{L}]))\s*/giu, "набережная "],
    [/(?<![\p{L}])плошча(?![\p{L}])/giu, "площадь"],
    [/(?<![\p{L}])пл(?:\.|(?![\p{L}]))\s*/giu, "площадь "],
    [/(?<![\p{L}])(?:шосе|шаша)(?![\p{L}])/giu, "шоссе"],
    [/(?<![\p{L}])ш(?:\.|(?![\p{L}]))\s*/giu, "шоссе "],
    [/(?<![\p{L}])туп(?:\.|(?![\p{L}]))\s*/giu, "тупик "],
    [/(?<![\p{L}])(?:мкр-н|мкрн|мкр|м-н)\.?\s*/giu, "микрорайон "],
    [/(?<![\p{L}])(?:дом|д)\.?\s*№\s*(?=\d)/giu, ""],
    [/(?<![\p{L}])№\s*(?=\d)/gu, ""],
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
    [/(?<![\p{L}])держинского(?![\p{L}])/giu, "Дзержинского"],
  ];
}

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

function preclean(raw: string): string {
  return collapse(
    raw
      .replace(/\u2116/g, " ")
      .normalize("NFKC")
      .replace(/[\u200b\u200c\u200d\ufeff\u00ad]/g, "")
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, " ")
      .replace(/(?:\+?\s*375|80)(?:[\s().-]*\d){9}/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/(?<![\p{L}])(?:адрес|адрас)\s*[:\-—]?\s*/giu, " ")
      .replace(/(?<![\p{L}])(?:сш|школа|фоц)\.?\s*(?:№|no\.?)?\s*\d{1,4}/giu, " ")
      .replace(/[«»""]/g, " ")
      .replace(/\((?:[^)(]|\([^)]*\))*\)/g, " ")
      .replace(/\p{L}+/gu, (token) => foldMixedToken(token)),
  );
}

export function expandStreetQuery(raw: string): string {
  let value = preclean(raw);
  for (const [pattern, replacement] of abbreviations()) {
    value = value.replace(pattern, replacement);
  }
  return collapse(value);
}

function cityIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const name of BELARUS_CITIES) index.set(foldAddress(name), name);
  for (const [latin, name] of Object.entries(LATIN_CITIES)) index.set(latin, name);
  return index;
}

const CITY_BY_FOLD = cityIndex();

function matchCity(token: string): string | null {
  return CITY_BY_FOLD.get(foldAddress(token)) ?? null;
}

function isCountry(token: string): boolean {
  return /^(?:беларусь|беларуси|беларусі|belarus|belarusi)$/iu.test(foldAddress(token));
}

function isStreetType(token: string): StreetType | null {
  const folded = foldAddress(token);
  if ((STREET_TYPES as readonly string[]).includes(folded)) return folded as StreetType;
  return TYPE_ALIASES[folded] ?? null;
}

function cyrillicHouseLetter(letter: string): string {
  const lower = letter.toLocaleLowerCase("ru");
  const mapped = HOUSE_LETTER[lower] ?? lower;
  return mapped.toLocaleUpperCase("ru");
}

function foldMixedToken(token: string): string {
  let cyrillic = 0;
  let latin = 0;
  for (const char of token) {
    if (/\p{Script=Cyrillic}/u.test(char)) cyrillic += 1;
    else if (/[A-Za-z]/.test(char)) latin += 1;
  }
  if (cyrillic === 0 || latin === 0) return token;
  return Array.from(token, (char) => {
    const mapped = HOUSE_LETTER[char.toLowerCase()];
    if (!mapped) return char;
    return char === char.toUpperCase() && char !== char.toLowerCase()
      ? mapped.toLocaleUpperCase("ru")
      : mapped;
  }).join("");
}

/** A Latin street name as a person types it from an English keyboard. */
function transliterateWord(word: string): string {
  if (!/^[A-Za-z][A-Za-z'`’.-]*$/u.test(word)) return word;
  const lower = word.toLowerCase().replace(/['’`]/g, "'");
  let index = 0;
  let out = "";
  while (index < lower.length) {
    let matched = false;
    for (const [latin, cyrillic] of DIGRAPHS) {
      if (lower.startsWith(latin, index)) {
        out += cyrillic;
        index += latin.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const char = lower[index] ?? "";
    if (char === "l" && index + 1 < lower.length && /[bcdfghjklmnpqrstvwxz]/.test(lower[index + 1] ?? "")) {
      out += "ль";
      index += 1;
      continue;
    }
    if (char === "'") {
      out += "ь";
      index += 1;
      continue;
    }
    out += LATIN_LETTER[char] ?? char;
    index += 1;
  }
  if (!out || out === lower) return word;
  return out.charAt(0).toLocaleUpperCase("ru") + out.slice(1);
}

function applyStreetSynonyms(value: string): string {
  let next = value;
  for (const [pattern, replacement] of streetNameSynonyms()) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

type House = { text: string | null; corpus: string | null };

function takeCorpus(value: string): { text: string; corpus: string | null } {
  const marked = /(?<![\p{L}])(?:корпус|корп\.?|строение|стр\.?|литера|лит\.?|к\.)\s*(\d{1,3})(?![\p{L}\d])/iu.exec(value);
  if (marked) {
    return {
      corpus: marked[1],
      text: `${value.slice(0, marked.index)} ${value.slice(marked.index + marked[0].length)}`,
    };
  }
  const afterLetter = /(?<![\p{L}])(\d{1,4}\s*[\p{L}])\s*к\s*(\d{1,3})(?![\p{L}\d])/iu.exec(value);
  if (afterLetter?.[1] && afterLetter[2]) {
    return {
      corpus: afterLetter[2],
      text: `${value.slice(0, afterLetter.index)}${afterLetter[1]} ${value.slice(afterLetter.index + afterLetter[0].length)}`,
    };
  }
  const glued = /(?<![\p{L}])(\d{1,4})\s*к\s*(\d{1,3})(?![\p{L}\d])/iu.exec(value);
  if (glued?.[1] && glued[2]) {
    return {
      corpus: glued[2],
      text: `${value.slice(0, glued.index)}${glued[1]} ${value.slice(glued.index + glued[0].length)}`,
    };
  }
  return { text: value, corpus: null };
}

function takeHouse(value: string): { text: string; house: string | null } {
  const fraction = /(?<![\p{L}\d])(\d{1,4})\s*\/\s*(\d{1,4})(?![\p{L}\d])/u.exec(value);
  const letter = /(?<![\p{L}\d])(\d{1,4})\s*[-–]?\s*([\p{L}])(?![\p{L}\d])/u.exec(value);
  const bare = /(?<![\p{L}\d])(\d{1,4})(?![\p{L}\d])/u.exec(value);
  const chosen = [fraction, letter, bare]
    .filter((match): match is RegExpExecArray => match != null)
    .sort((a, b) => a.index - b.index)[0];
  if (!chosen) return { text: value, house: null };
  const number = chosen[1] ?? "";
  if (/^(?:19|20)\d{2}$/.test(number) && chosen !== letter && chosen !== fraction) {
    return { text: value, house: null };
  }
  const house = chosen === fraction
    ? `${number}/${chosen[2]}`
    : chosen === letter
      ? `${number}${cyrillicHouseLetter(chosen[2] ?? "")}`
      : number;
  return {
    house,
    text: `${value.slice(0, chosen.index)} ${value.slice(chosen.index + chosen[0].length)}`,
  };
}

type ParsedAddress = {
  type: StreetType | null;
  name: string;
  alternateName: string | null;
  house: House;
  city: string | null;
};

function parseChunk(chunk: string, cityHint: string): ParsedAddress | null {
  const corpus = takeCorpus(chunk);
  const housed = takeHouse(corpus.text);
  const tokens = collapse(housed.text).split(/[^\p{L}]+/u).filter(Boolean).map(foldMixedToken);
  let city = matchCity(cityHint.trim());
  const nameTokens: string[] = [];
  let type: StreetType | null = null;
  for (const token of tokens) {
    if (isCountry(token)) continue;
    const foundCity = matchCity(token);
    if (foundCity) {
      city ??= foundCity;
      continue;
    }
    const foundType = isStreetType(token);
    if (foundType && !type) {
      type = foundType;
      continue;
    }
    if (NOISE_WORDS.has(foldAddress(token))) continue;
    if (/^\p{L}$/u.test(token)) continue;
    if (/^\d{1,4}\p{L}?$/u.test(token)) continue;
    nameTokens.push(token);
  }
  if (nameTokens.length === 0) return null;
  const typed = nameTokens.join(" ");
  const transliterated = nameTokens.map(transliterateWord).join(" ");
  const russian = focusVenue(applyStreetSynonyms(transliterated));
  const name = collapse(russian.name);
  if (!name) return null;
  const alternate = russian.alternate && collapse(russian.alternate) !== name
    ? collapse(russian.alternate)
    : collapse(transliterated) !== name
      ? collapse(transliterated)
      : transliterated !== typed
        ? typed
        : null;
  return {
    type,
    name,
    alternateName: alternate && alternate !== name ? alternate : null,
    house: { text: housed.house, corpus: corpus.corpus },
    city,
  };
}

function focusVenue(name: string): { name: string; alternate: string | null } {
  const fixed = name.replace(/(?<![\p{L}])дворца(?![\p{L}])/giu, "дворец");
  const onStreet = fixed.match(/^(.*?)\s+на\s+\p{L}/iu);
  const short = onStreet?.[1] && /дворец|зал|центр|бассейн|стадион|клуб/iu.test(onStreet[1])
    ? collapse(onStreet[1])
    : fixed;
  return { name: short, alternate: short === name ? null : name };
}

function splitHouses(value: string): string[] {
  const re = /(?<![\p{L}\d])(\d{1,4})(?:\s*\/\s*\d{1,4}|\s*[а-яёa-z])?(?![\p{L}\d])/giu;
  const matches = [...value.matchAll(re)].filter((match) => !/^(?:19|20)\d{2}$/.test(match[1] ?? ""));
  const first = matches[0];
  const second = matches[1];
  if (!first || !second || first.index == null) return [value];
  const right = value.slice(first.index + first[0].length);
  if (!/\p{L}{3,}/u.test(right)) return [value];
  return [value.slice(0, first.index + first[0].length), right];
}

function splitChunks(expanded: string): string[] {
  const typeAt = /(?<![\p{L}])(?:проспект|улица|переулок|бульвар|набережная|площадь|шоссе|проезд|тупик|тракт|микрорайон)(?![\p{L}])/giu;
  const indexes = [...expanded.matchAll(typeAt)].map((match) => match.index ?? 0);
  if (indexes.length < 2 || indexes[1] == null) return [expanded];
  return [expanded.slice(0, indexes[1]), expanded.slice(indexes[1])];
}

export type AddressSearch = {
  /** Free-text query. The city is included once. The country is not. */
  q: string;
  /** Nominatim structured street: house, then type, then name. */
  street: string | null;
  city: string | null;
  streetType: StreetType | null;
  house: string | null;
  corpus: string | null;
};

function line(type: StreetType | null, name: string, house: string | null, city: string | null, typePosition: "before" | "after" | "none"): string {
  const title = type && typePosition !== "none" ? TYPE_TITLE[type] : "";
  const street = typePosition === "after"
    ? collapse([name, title].filter(Boolean).join(" "))
    : typePosition === "before"
      ? collapse([title, name].filter(Boolean).join(" "))
      : name;
  return collapse([street, house, city].filter(Boolean).join(", "));
}

function pushPlan(plans: AddressSearch[], plan: AddressSearch) {
  const key = plan.q.toLocaleLowerCase("ru");
  if (!sanitizeQuery(plan.q)) return;
  if (plans.some((item) => item.q.toLocaleLowerCase("ru") === key)) return;
  plans.push(plan);
}

function plansFor(parsed: ParsedAddress, typePosition: "before" | "after" | "none", name: string): AddressSearch {
  const type = typePosition === "none" ? null : parsed.type;
  const q = line(parsed.type, name, parsed.house.text, parsed.city, typePosition);
  const streetParts = typePosition === "after"
    ? [parsed.house.text, name, type ? TYPE_TITLE[type] : ""]
    : [parsed.house.text, type ? TYPE_TITLE[type] : "", name];
  const street = collapse(streetParts.filter(Boolean).join(" "));
  const structured = typePosition !== "none" && Boolean(parsed.house.text || type);
  return {
    q,
    street: structured ? street : null,
    city: parsed.city,
    streetType: type,
    house: parsed.house.text,
    corpus: parsed.house.corpus,
  };
}

/**
 * Lookup attempts, most specific first.
 * At most four. A repeated city and the word «Беларусь» are not part of them.
 */
export function addressSearches(raw: string, cityHint = ""): AddressSearch[] {
  const expanded = expandStreetQuery(raw);
  if (!expanded) return [];
  const chunks = splitChunks(expanded).flatMap(splitHouses).slice(0, 2);
  const plans: AddressSearch[] = [];
  chunks.forEach((chunk, index) => {
    const parsed = parseChunk(chunk, cityHint);
    if (!parsed) return;
    if (index === 0) {
      pushPlan(plans, plansFor(parsed, parsed.type ? "before" : "none", parsed.name));
      if (parsed.type) pushPlan(plans, plansFor(parsed, "after", parsed.name));
      if (parsed.alternateName) {
        pushPlan(plans, plansFor(parsed, parsed.type ? "before" : "none", parsed.alternateName));
      }
      if (parsed.type) pushPlan(plans, plansFor(parsed, "none", parsed.name));
      return;
    }
    pushPlan(plans, plansFor(parsed, parsed.type ? "before" : "none", parsed.name));
  });
  return plans.slice(0, 4);
}

/** The free-text form of `addressSearches`. */
export function addressLookupQueries(raw: string, cityHint = ""): string[] {
  return addressSearches(raw, cityHint).map((plan) => plan.q);
}

/** A street name is present, so a remote lookup is worth the rate limit. */
export function addressQueryReady(raw: string, cityHint = ""): boolean {
  return addressSearches(raw, cityHint).some((plan) =>
    addressTokens(plan.q).some((token) => token.length >= 4 && !ADDRESS_STOP.has(token) && !matchCity(token)),
  );
}

function addressTokens(value: string): string[] {
  return foldAddress(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function houseTokens(value: string): Array<{ number: string; letter: string }> {
  return [...foldAddress(value).matchAll(/(?<![\p{L}\d])(\d{1,4})([а-яa-z])?(?![\p{L}\d])/gu)].map((match) => ({
    number: match[1] ?? "",
    letter: cyrillicHouseLetter(match[2] ?? "").toLocaleLowerCase("ru"),
  })).filter((item) => item.number && !/^(?:19|20)\d{2}$/.test(item.number));
}

function queryStreetType(query: string): StreetType | null {
  for (const token of addressTokens(query)) {
    const type = isStreetType(token);
    if (type) return type;
  }
  return null;
}

function hitStreetType(value: string): StreetType | null {
  for (const token of addressTokens(value)) {
    const type = isStreetType(token);
    if (type) return type;
  }
  return null;
}

function namesAgree(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5) return false;
  return left.startsWith(right.slice(0, 5)) || right.startsWith(left.slice(0, 5));
}

/**
 * How well a Nominatim hit names the same street or place.
 * Zero means the hit is only the city, a different street, or a different street type.
 */
export function addressHitScore(
  query: string,
  hit: { street: string; displayName: string; city: string },
  hint?: { streetType?: StreetType | null; house?: string | null; corpus?: string | null },
): number {
  const ignore = new Set(ADDRESS_STOP);
  for (const token of addressTokens(hit.city)) ignore.add(token);
  const names = addressTokens(query).filter((token) => token.length >= 4 && !ignore.has(token) && !/^\d+$/.test(token) && !matchCity(token));
  const hitNames = addressTokens(`${hit.street} ${hit.displayName}`).filter((token) => !ignore.has(token));
  const nameHits = names.filter((token) => hitNames.some((item) => namesAgree(token, item))).length;
  if (names.length > 0 && nameHits === 0) return 0;
  const wantedType = hint?.streetType ?? queryStreetType(query);
  const foundType = hitStreetType(`${hit.street} ${hit.displayName}`);
  if (wantedType && foundType && wantedType !== foundType) return 0;
  const wanted = houseTokens(hint?.house ? hint.house : query);
  const found = houseTokens(`${hit.street} ${hit.displayName}`);
  const numberHit = wanted.some((house) => found.some((item) => item.number === house.number));
  const letterHit = wanted.some((house) => house.letter && found.some((item) => item.number === house.number && item.letter === house.letter));
  if (names.length === 0 && !numberHit) return 0;
  const corpus = hint?.corpus?.trim() ?? "";
  const corpusHit = corpus ? new RegExp(`(?<!\\d)${corpus}(?!\\d)`).test(foldAddress(`${hit.street} ${hit.displayName}`)) : false;
  return nameHits + (letterHit ? 6 : numberHit ? 3 : 0) + (wantedType && foundType ? 2 : 0) + (corpusHit ? 3 : 0);
}

/** Trim and collapse whitespace. Queries shorter than 3 characters are rejected. */
export function sanitizeQuery(raw: string): string | null {
  const collapsed = collapse(preclean(raw));
  if (collapsed.length < 3 || collapsed.length > 200) return null;
  return collapsed;
}

/**
 * Cache key: lower case, punctuation removed, spaces collapsed.
 * A Latin house letter and its Cyrillic twin share one key.
 * Returns null when the sanitized query is empty or shorter than 3 characters.
 */
export function normalizeQuery(raw: string): string | null {
  const sanitized = sanitizeQuery(raw);
  if (!sanitized) return null;
  const stripped = foldAddress(sanitized)
    .replace(/(\d+)([a-z])/gi, (_, house: string, letter: string) => `${house}${cyrillicHouseLetter(letter).toLocaleLowerCase("ru")}`)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 3) return null;
  return stripped;
}
