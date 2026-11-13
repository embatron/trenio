/**
 * Sport words on an Instagram profile are inflected and sometimes glued to a hashtag.
 * The import matches the catalog alias, not only the dictionary form.
 */

const ENDING = [
  "ами", "ями", "ою", "ею", "ому", "ему", "ого", "его", "ыми", "ими",
  "ой", "ый", "ий", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю",
  "ах", "ях", "ом", "ем", "ов", "ев", "ей", "ам", "ям",
  "ым", "им", "а", "я", "ы", "и", "е", "у", "ю", "о",
].join("|");

export function foldYo(value: string): string {
  return value.replace(/ё/gi, (char) => (char === "Ё" ? "Е" : "е"));
}

function wordPattern(word: string): string {
  const lower = foldYo(word.toLowerCase());
  if (/(?:ий|ый|ой|ая|яя|ое|ее)$/u.test(lower) && [...lower].length > 4) {
    return `(?:${lower}|${lower.slice(0, -2)}(?:${ENDING}))`;
  }
  if (/[аеёиоуыэюя]$/u.test(lower) && [...lower].length >= 4) {
    return `(?:${lower}|${lower.slice(0, -1)}(?:${ENDING}))`;
  }
  // «футбол» also appears as «футбольный».
  return `(?:${lower}(?:${ENDING})?|${lower}ьн(?:${ENDING})?)`;
}

/** A catalog alias, including an inflected form. «йоге» matches «йога». «бокс» does not match inside «кикбоксинг». */
export function sportAliasRegex(alias: string): RegExp {
  const parts = alias.trim().toLowerCase().split(/\s+/).filter(Boolean).map(wordPattern);
  return new RegExp(`(?<![\\p{L}])${parts.join("[\\s-]*")}(?![\\p{L}])`, "iu");
}

/**
 * Split a hashtag that glues a sport to a city: «#пилатесминск».
 * The rest of the text stays as written.
 */
export function prepareSportText(text: string, settlements: string[], aliases: string[]): string {
  const aliasList = [...new Set(aliases.map((item) => foldYo(item.toLowerCase())).filter((item) => [...item].length >= 4))]
    .sort((a, b) => [...b].length - [...a].length);
  const cityList = [...new Set(settlements.map((item) => foldYo(item.toLowerCase())).filter((item) => [...item].length >= 4))]
    .sort((a, b) => [...b].length - [...a].length);
  return text.replace(/#[\p{L}\d_]+/gu, (tag) => {
    let body = foldYo(tag.slice(1).toLowerCase());
    for (const alias of aliasList) {
      if (body.startsWith(alias) && body.length >= alias.length + 3) {
        body = `${alias} ${body.slice(alias.length)}`;
        break;
      }
    }
    const parts = body.split(" ");
    const last = parts[parts.length - 1] || "";
    for (const city of cityList) {
      if (last.endsWith(city) && last.length >= city.length + 3) {
        parts[parts.length - 1] = `${last.slice(0, -city.length)} ${city}`;
        body = parts.join(" ");
        break;
      }
    }
    return ` ${body} `;
  });
}
