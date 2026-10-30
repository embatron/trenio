/** Flexible match of a typed city or sport against the words we already store. */

const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,./`";
const RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбю.ё";

const EN_TO_RU = new Map<string, string>(Array.from(EN_KEYS, (char, index) => [char, RU_KEYS[index] ?? char]));
const RU_TO_EN = new Map<string, string>(Array.from(RU_KEYS, (char, index) => [char, EN_KEYS[index] ?? char]));

const LOOKALIKE_TO_RU: Record<string, string> = {
  a: "а",
  e: "е",
  o: "о",
  p: "р",
  c: "с",
  y: "у",
  x: "х",
  k: "к",
};

const LOOKALIKE_TO_EN = Object.fromEntries(
  Object.entries(LOOKALIKE_TO_RU).map(([latin, cyrillic]) => [cyrillic, latin]),
);

export type FlexTarget = {
  label: string;
  aliases?: string[];
  loose?: string[];
};

export type FlexHit = {
  rank: number;
  distance: number;
  labelGap: number;
  /** The whole stored phrase matched, not a word buried inside a longer name. */
  whole: boolean;
  /** Shared starting letters with the typed query. Longer wins a tie. */
  prefix: number;
  /** Matched only through a parent category phrase copied onto a child. */
  loose: boolean;
};

const FUZZY_RANK = 20;

export function foldSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[!?()"«»]+/g, " ")
    .replace(/([а-я])[,./;'[\]]+(?=[а-я\s]|$)/g, "$1 ")
    .replace(/(^|\s)[,./;'[\]]+(?=[а-я])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/[\s-]+/g, "");
}

function mapKeys(value: string, table: Map<string, string>): string {
  return Array.from(value, (char) => table.get(char) ?? char).join("");
}

/** Russian word typed while the keyboard was still Latin. */
export function keyboardToRussian(value: string): string {
  return mapKeys(foldSearchText(value), EN_TO_RU);
}

/** Latin word typed while the keyboard was still Russian. */
export function keyboardToLatin(value: string): string {
  return mapKeys(foldSearchText(value), RU_TO_EN);
}

function alignLookalikes(value: string): string {
  let cyrillic = 0;
  let latin = 0;
  for (const char of value) {
    if (/[а-я]/.test(char)) cyrillic += 1;
    else if (/[a-z]/.test(char)) latin += 1;
  }
  if (cyrillic === 0 || latin === 0) return value;
  const towardCyrillic = cyrillic >= latin;
  return Array.from(value, (char) => {
    if (towardCyrillic) return LOOKALIKE_TO_RU[char] ?? char;
    return LOOKALIKE_TO_EN[char] ?? char;
  }).join("");
}

export function queryReadings(value: string): string[] {
  const folded = foldSearchText(value);
  if (!folded) return [];
  const seeds = new Set<string>([folded, alignLookalikes(folded)]);
  const readings = new Set<string>(seeds);
  for (const seed of seeds) {
    if (/[a-z]/.test(seed)) readings.add(keyboardToRussian(seed));
    if (/[а-я]/.test(seed)) readings.add(keyboardToLatin(seed));
  }
  readings.delete("");
  return [...readings];
}

function typoBudget(length: number): number {
  if (length < 3) return 0;
  if (length < 8) return 1;
  return 2;
}

/** Optimal string alignment: substitution, insertion, deletion, adjacent swap. */
export function editDistance(left: string, right: string, max: number): number | null {
  if (left === right) return 0;
  const a = Array.from(left);
  const b = Array.from(right);
  const width = b.length;
  if (Math.abs(a.length - width) > max) return null;
  if (max === 0) return null;

  let before = new Array<number>(width + 1).fill(0);
  let previous = Array.from({ length: width + 1 }, (_, index) => index);
  let current = new Array<number>(width + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= width; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
    }
    const stale = before;
    before = previous;
    previous = current;
    current = stale;
  }

  const distance = previous[width] ?? max + 1;
  return distance <= max ? distance : null;
}

function wordsOf(phrase: string): string[] {
  return phrase.split(/[\s-]+/).filter((word) => word.length > 0);
}

function commonPrefix(left: string, right: string): number {
  const size = Math.min(left.length, right.length);
  let index = 0;
  while (index < size && left[index] === right[index]) index += 1;
  return index;
}

function coversWord(word: string, query: string): boolean {
  return word.includes(query) && query.length * 2 >= word.length;
}

function strictRank(query: string, phrase: string, offset: number): { rank: number; whole: boolean } | null {
  if (!query || !phrase) return null;
  const words = wordsOf(phrase);
  const squeezed = compact(phrase);
  if (phrase === query || (squeezed.length >= 4 && squeezed === compact(query))) return { rank: offset, whole: true };
  if (query.length >= 2 && words.some((word) => word === query)) return { rank: 4 + offset, whole: false };
  if (phrase.startsWith(query)) return { rank: 8 + offset, whole: true };
  if (query.length >= 2 && words.some((word) => word.startsWith(query))) return { rank: 12 + offset, whole: false };
  if (query.length >= 2 && words.some((word) => coversWord(word, query))) return { rank: 16 + offset, whole: false };
  return null;
}

function fuzzyRank(query: string, phrase: string, offset: number): { rank: number; distance: number; whole: boolean } | null {
  const budget = typoBudget(query.length);
  if (budget === 0) return null;
  const tokens = [phrase, ...wordsOf(phrase)];
  let best: { distance: number; whole: boolean } | null = null;
  tokens.forEach((token, index) => {
    if (token.length < 2 || Math.abs(token.length - query.length) > budget) return;
    const distance = editDistance(query, token, budget);
    if (distance == null || distance === 0) return;
    const whole = index === 0;
    if (!best || distance < best.distance || (distance === best.distance && whole && !best.whole)) {
      best = { distance, whole };
    }
  });
  if (!best) return null;
  return { rank: FUZZY_RANK + offset, distance: best.distance, whole: best.whole };
}

type Phrase = { text: string; offset: number; fuzzy: boolean };

function phrasesOf(target: FlexTarget): Phrase[] {
  return [
    { text: target.label, offset: 0, fuzzy: true },
    ...(target.aliases ?? []).map((text) => ({ text, offset: 1, fuzzy: true })),
    ...(target.loose ?? []).map((text) => ({ text, offset: 2, fuzzy: false })),
  ];
}

function bestHit(readings: string[], target: FlexTarget, fuzzy: boolean): FlexHit | null {
  const labelLength = foldSearchText(target.label).length;
  let best: FlexHit | null = null;
  for (const reading of readings) {
    const labelGap = Math.abs(labelLength - reading.length);
    for (const phrase of phrasesOf(target)) {
      if (fuzzy && !phrase.fuzzy) continue;
      const text = foldSearchText(phrase.text);
      const found = fuzzy ? fuzzyRank(reading, text, phrase.offset) : strictRank(reading, text, phrase.offset);
      if (!found) continue;
      const hit: FlexHit = {
        rank: found.rank,
        distance: "distance" in found ? found.distance : 0,
        labelGap,
        whole: found.whole,
        prefix: commonPrefix(reading, text),
        loose: phrase.offset >= 2,
      };
      if (!best || compareFlex(hit, best) < 0) best = hit;
    }
  }
  return best;
}

export function compareFlex(left: FlexHit, right: FlexHit): number {
  return left.rank - right.rank
    || left.distance - right.distance
    || Number(right.whole) - Number(left.whole)
    || right.prefix - left.prefix
    || left.labelGap - right.labelGap;
}

function sameBand(left: FlexHit, right: FlexHit): boolean {
  return left.rank === right.rank && left.distance === right.distance && left.whole === right.whole;
}

export function rankTargets<T>(
  query: string,
  items: readonly T[],
  targetOf: (item: T) => FlexTarget,
  prefer: (item: T) => number = () => 0,
): Array<{ item: T; hit: FlexHit }> {
  const readings = queryReadings(query);
  if (readings.length === 0) return [];

  const collect = (fuzzy: boolean) => {
    const rows: Array<{ item: T; hit: FlexHit }> = [];
    for (const item of items) {
      const hit = bestHit(readings, targetOf(item), fuzzy);
      if (hit) rows.push({ item, hit });
    }
    return rows;
  };

  const strict = collect(false);
  let pool = strict;
  if (strict.length === 0) {
    const fuzzy = collect(true);
    const minDistance = fuzzy.reduce((min, row) => Math.min(min, row.hit.distance), Number.POSITIVE_INFINITY);
    pool = fuzzy.filter((row) => row.hit.distance === minDistance);
  } else {
    const own = strict.filter((row) => !row.hit.loose && row.hit.rank < 8);
    pool = own.length > 0 ? own : strict.filter((row) => !row.hit.loose);
    if (pool.length === 0) pool = strict;
  }

  return pool.sort((left, right) => (
    compareFlex(left.hit, right.hit)
    || prefer(left.item) - prefer(right.item)
    || foldSearchText(targetOf(left.item).label).localeCompare(foldSearchText(targetOf(right.item).label), "ru")
  ));
}

/** One stored word is clearly closer than the rest. A short shared prefix stays unresolved. */
export function leadingTarget<T>(ranked: ReadonlyArray<{ item: T; hit: FlexHit }>, query: string): T | null {
  const best = ranked[0];
  if (!best || best.hit.loose) return null;
  const contested = ranked.some((row, index) => index > 0 && sameBand(row.hit, best.hit));
  if (contested) return null;
  const length = foldSearchText(query).length;
  if (best.hit.rank < 8) return best.item;
  if (best.hit.rank < 16) return length >= 3 ? best.item : null;
  if (best.hit.rank < FUZZY_RANK) return length >= 4 ? best.item : null;
  return length >= 3 ? best.item : null;
}
