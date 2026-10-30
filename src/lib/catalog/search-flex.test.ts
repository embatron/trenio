import assert from "node:assert/strict";
import test from "node:test";

import { listCatalogSports, catalogSportByName, filterCatalogSports } from "./catalog-sports";
import { BELARUS_CITIES, BELARUS_QUICK_CITIES, filterBelarusCities, resolveBelarusCity } from "./city-taxonomy";
import { editDistance, foldSearchText, keyboardToLatin, keyboardToRussian } from "./query-flex";
import { filterSportSuggestions, quickSportLabels } from "./sport-suggestions";

function edits(value: string): string[] {
  const chars = Array.from(value);
  const out: string[] = [];
  for (let index = 0; index < chars.length; index += 1) {
    out.push(chars.filter((_, at) => at !== index).join(""));
    const doubled = chars.slice();
    const current = doubled[index];
    if (current) doubled.splice(index, 1, current, current);
    out.push(doubled.join(""));
    if (index + 1 < chars.length) {
      const swapped = chars.slice();
      const left = swapped[index];
      const right = swapped[index + 1];
      if (left && right) {
        swapped[index] = right;
        swapped[index + 1] = left;
        out.push(swapped.join(""));
      }
    }
  }
  return [...new Set(out)].filter((item) => item !== value && item.length >= 3);
}

function swapPair(value: string): string {
  const chars = Array.from(value);
  const index = 1;
  const left = chars[index];
  const right = chars[index + 1];
  if (!left || !right) return value;
  chars[index] = right;
  chars[index + 1] = left;
  return chars.join("");
}

test("keyboard layout maps a Russian word onto Latin keys and back", () => {
  assert.equal(keyboardToLatin("привет"), "ghbdtn");
  assert.equal(keyboardToRussian("ghbdtn"), "привет");
  assert.equal(keyboardToRussian("vbycr"), "минск");
  assert.equal(keyboardToRussian("qjuf"), "йога");
  assert.equal(keyboardToRussian("abnytc"), "фитнес");
  assert.equal(editDistance("минск", "мниск", 1), 1);
  assert.equal(editDistance("минск", "пинск", 1), 1);
});

test("every Belarus city survives a Latin keyboard and a swapped pair", () => {
  for (const city of BELARUS_CITIES) {
    const folded = foldSearchText(city);
    const latin = keyboardToLatin(folded);
    assert.equal(resolveBelarusCity(latin), city, latin);
    assert.equal(filterBelarusCities(latin)[0], city, latin);
    if (Array.from(folded).length < 4) continue;
    const typo = swapPair(folded);
    assert.equal(filterBelarusCities(typo)[0], city, typo);
    assert.equal(resolveBelarusCity(typo), city, typo);
  }
});

test("city field fixes a wrong layout, a missing letter, and an extra letter", () => {
  assert.equal(resolveBelarusCity("vbycr"), "Минск");
  assert.equal(resolveBelarusCity("могилев"), "Могилёв");
  assert.equal(resolveBelarusCity("в минске"), "Минск");
  assert.equal(resolveBelarusCity("буда кошелево"), "Буда-Кошелёво");
  assert.equal(resolveBelarusCity("минс"), "Минск");
  assert.equal(resolveBelarusCity("минскк"), "Минск");
  assert.equal(filterBelarusCities("минск").includes("Пинск"), false);
  assert.equal(resolveBelarusCity("го"), null);
  assert.equal(filterBelarusCities("")[0], "Минск");
});

test("every published sport survives a Latin keyboard and a swapped pair", () => {
  for (const sport of listCatalogSports()) {
    const folded = foldSearchText(sport.label);
    const latin = keyboardToLatin(folded);
    assert.equal(catalogSportByName(latin)?.id, sport.id, latin);
    assert.equal(filterCatalogSports(latin, 8)[0]?.id, sport.id, latin);
    if (Array.from(folded).length < 4) continue;
    const typo = swapPair(folded);
    assert.equal(filterCatalogSports(typo, 8)[0]?.id, sport.id, `${sport.label} ${typo}`);
    assert.equal(catalogSportByName(typo)?.id, sport.id, `${sport.label} ${typo}`);
  }
});

test("sport field fixes layout, alias, and a jammed pair without grabbing a neighbour", () => {
  assert.equal(catalogSportByName("qjuf")?.label, "Йога");
  assert.equal(catalogSportByName("йоаг")?.label, "Йога");
  assert.equal(catalogSportByName("abnytc")?.label, "Фитнес");
  assert.equal(catalogSportByName("фитнез")?.label, "Фитнес");
  assert.equal(catalogSportByName("mma")?.label, "MMA");
  assert.equal(catalogSportByName("ььф")?.label, "MMA");
  assert.equal(catalogSportByName("crossfit")?.label, "Кроссфит");
  assert.equal(catalogSportByName("йога")?.level, 2);
  assert.equal(catalogSportByName("бо"), null);
  assert.equal(filterSportSuggestions("qjuf")[0], "Йога");
  assert.equal(filterSportSuggestions("йоаг")[0], "Йога");
  assert.ok(filterSportSuggestions("бо").includes("Бокс"));
  assert.ok(filterSportSuggestions("").includes("Бокс"));
  assert.equal(catalogSportByName("лодки"), null);
  assert.ok(filterCatalogSports("лодки", 8).length > 1);
});

test("anti-patterns: noise, neighbours, and shared words do not pick a wrong name", () => {
  assert.equal(resolveBelarusCity("олев"), "Лоев");
  assert.equal(filterBelarusCities("олев").includes("Смолевичи"), false);
  assert.equal(resolveBelarusCity("периков"), null);
  assert.deepEqual(filterBelarusCities("периков").slice(0, 2), ["Петриков", "Чериков"]);
  assert.equal(resolveBelarusCity("хинск"), null);
  assert.ok(filterBelarusCities("хинск").includes("Минск"));
  assert.ok(filterBelarusCities("хинск").includes("Пинск"));
  assert.equal(resolveBelarusCity("минск!!!"), "Минск");
  assert.equal(resolveBelarusCity("г. минск"), "Минск");
  assert.equal(resolveBelarusCity("в г. минске"), "Минск");
  assert.equal(resolveBelarusCity("в гомеле"), "Гомель");
  assert.equal(resolveBelarusCity("го"), null);
  assert.equal(resolveBelarusCity("minsk"), null);
  assert.equal(catalogSportByName("минск"), null);
  assert.equal(catalogSportByName("минск!!!"), null);
  assert.equal(catalogSportByName("yoga"), null);
  assert.equal(catalogSportByName(",jrc")?.label, "Бокс");
  assert.equal(catalogSportByName("скет")?.label, "Скейт");
  assert.equal(catalogSportByName("лодки"), null);
  assert.equal(catalogSportByName("персональный тренер"), null);
  assert.ok(filterCatalogSports("персональный тренер", 8).length > 1);
  assert.deepEqual(filterSportSuggestions("йога"), ["Йога", "Йога и растяжка"]);
  assert.deepEqual(filterSportSuggestions("qjuf"), ["Йога", "Йога и растяжка"]);
  assert.equal(filterSportSuggestions("бокс")[0], "Бокс");
  assert.equal(filterSportSuggestions("бокс").includes("Кикбоксинг"), false);
  assert.equal(catalogSportByName("го")?.label, "Го");

  assert.deepEqual(filterBelarusCities(""), [...BELARUS_QUICK_CITIES]);
  assert.deepEqual(filterSportSuggestions(""), quickSportLabels());
  for (const query of ["", " ", "в", "...", "аааа", "qwerty", "asdf", "<script>", "a".repeat(300)]) {
    assert.equal(resolveBelarusCity(query), null, query);
    assert.equal(catalogSportByName(query), null, query);
    assert.ok(filterSportSuggestions(query).length <= 8, query);
  }
});

test("a one-letter edit never resolves to a different city that is no closer", () => {
  for (const city of BELARUS_CITIES) {
    const folded = foldSearchText(city);
    for (const typo of edits(folded)) {
      const winner = resolveBelarusCity(typo);
      if (!winner || winner === city) continue;
      const toSource = editDistance(typo, folded, 2);
      const toWinner = editDistance(typo, foldSearchText(winner), 2);
      assert.ok(
        toSource == null || (toWinner != null && toSource > toWinner),
        `${typo} of ${city} -> ${winner}`,
      );
    }
  }
});

test("a one-letter edit never resolves to a sport that is farther than the source", () => {
  for (const sport of listCatalogSports()) {
    const folded = foldSearchText(sport.label);
    if (Array.from(folded).length < 4) continue;
    for (const typo of edits(folded)) {
      const winner = catalogSportByName(typo);
      if (!winner || winner.id === sport.id) continue;
      const toSource = editDistance(typo, folded, 2);
      const toWinner = editDistance(typo, foldSearchText(winner.label), 2);
      assert.ok(
        toSource == null || (toWinner != null && toSource > toWinner),
        `${typo} of ${sport.label} -> ${winner.label}`,
      );
    }
  }
});
