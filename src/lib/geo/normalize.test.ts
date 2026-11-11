import assert from "node:assert/strict";
import test from "node:test";

import { isSpecificAddress } from "@/lib/geo/schemas";
import {
  addressHitScore,
  addressLookupQueries,
  addressQueryReady,
  addressSearches,
  expandStreetQuery,
  normalizeQuery,
  sanitizeQuery,
} from "@/lib/geo/normalize";

test("sanitizeQuery trims, collapses spaces, and drops short text", () => {
  assert.equal(sanitizeQuery("  Минск   "), "Минск");
  assert.equal(sanitizeQuery("  ул.   Пушкина  12 "), "ул. Пушкина 12");
  assert.equal(sanitizeQuery("ab"), null);
  assert.equal(sanitizeQuery("   "), null);
});

test("normalizeQuery lowercases and strips punctuation", () => {
  assert.equal(normalizeQuery("Минск, ул. Пушкина, 12"), "минск ул пушкина 12");
  assert.equal(normalizeQuery("ab!!"), null);
  assert.equal(normalizeQuery("Минск"), "минск");
  assert.equal(normalizeQuery("Сурганова 4A"), normalizeQuery("Сурганова 4\u0410"));
});

test("expandStreetQuery unfolds a street abbreviation and leaves a full word", () => {
  assert.equal(expandStreetQuery("пр.Дзержинского"), "проспект Дзержинского");
  assert.equal(expandStreetQuery("пр-т.Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("пр.т Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("п-т Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("пр т Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("просп.Пушкина"), "проспект Пушкина");
  assert.equal(expandStreetQuery("пр Независимости, 32\u0410"), "проспект Независимости, 32\u0410");
  assert.equal(expandStreetQuery("ул.Олега Кошевого, д. 30"), "улица Олега Кошевого, 30");
  assert.equal(expandStreetQuery("вул. Сурганава 5"), "улица Сурганава 5");
  assert.equal(expandStreetQuery("г. Минск, праспект Пераможцаў"), "Минск, проспект Пераможцаў");
  assert.equal(expandStreetQuery("проспект Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("Проспект Независимости"), "Проспект Независимости");
  assert.equal(expandStreetQuery("шоссе"), "шоссе");
  assert.equal(expandStreetQuery("Городская"), "Городская");
  assert.equal(expandStreetQuery("практика"), "практика");
  assert.equal(expandStreetQuery("пер. Козлова"), "переулок Козлова");
  assert.equal(expandStreetQuery("б-р Мулявина"), "бульвар Мулявина");
  assert.equal(expandStreetQuery("пр-д Кольцова"), "проезд Кольцова");
});

test("addressLookupQueries canonicalizes case, house letters, corpus, and a repeated city", () => {
  const cyrillicA = "\u0410";
  assert.deepEqual(addressLookupQueries(`пр Независимости, 32${cyrillicA}, стр. 2`), [
    `Проспект Независимости, 32${cyrillicA}`,
    `Независимости Проспект, 32${cyrillicA}`,
    `Независимости, 32${cyrillicA}`,
  ]);
  assert.ok(addressLookupQueries("вул. Незалежнасці, 10").includes("Улица Независимости, 10"));
  assert.deepEqual(addressLookupQueries("проспект Победителей, 11"), addressLookupQueries("Проспект Победителей, 11"));
  assert.equal(addressLookupQueries("ул. Ленина д.5 к.2")[0], "Улица Ленина, 5");
  assert.equal(addressLookupQueries("Сурганова 4A")[0], `Сурганова, 4${cyrillicA}`);
  assert.equal(addressLookupQueries("Сурганова 32-а")[0], `Сурганова, 32${cyrillicA}`);
  assert.equal(
    addressLookupQueries("г. Минск, пр-т Победителей, 11, Минск, Беларусь")[0],
    "Проспект Победителей, 11, Минск",
  );
  assert.equal(addressLookupQueries("Masherova 17/4, Minsk")[0], "Машерова, 17/4, Минск");
  assert.equal(addressLookupQueries("Olshevskogo 11, Minsk")[0], "Ольшевского, 11, Минск");
  assert.equal(addressLookupQueries("Nalibokskaya 2")[0], "Налибокская, 2");
  assert.equal(addressLookupQueries("Kalvariyskaya 5")[0], "Кальварийская, 5");
  assert.equal(addressLookupQueries("Dzerzhinskogo 16")[0], "Дзержинского, 16");
  assert.equal(addressLookupQueries("Каховская ул., 74")[0], "Улица Каховская, 74");
  assert.equal(addressSearches("Проспект Победителей, 11, Минск")[0]?.street, "11 Проспект Победителей");
  assert.equal(addressQueryReady("пр."), false);
  assert.equal(addressQueryReady("проспект"), false);
  assert.equal(addressQueryReady("пр-т Победителей"), true);
});

test("every street word is recognized before the name, after it, and with the city around it", () => {
  const forms: Record<string, string[]> = {
    Проспект: ["пр-т", "пр-кт", "пр.", "пр", "просп.", "просп", "праспект", "прасп.", "п-т", "пр.т", "пр т", "проспект", "Проспект", "ПРОСПЕКТ"],
    Улица: ["ул.", "ул", "вул.", "вул", "вуліца", "уліца", "улица", "Улица"],
    Переулок: ["пер.", "пер", "переул.", "переул", "завулак", "переулок", "Переулок"],
    Бульвар: ["б-р", "бул.", "бульв.", "бульвар", "Бульвар"],
    Набережная: ["наб.", "наб", "набярэжная", "набережная", "Набережная"],
    Площадь: ["пл.", "пл", "плошча", "площадь", "Площадь"],
    Шоссе: ["ш.", "шосе", "шаша", "шоссе", "Шоссе"],
    Проезд: ["пр-д", "праезд", "проезд", "Проезд"],
    Тупик: ["туп.", "туп", "тупик", "Тупик"],
    Тракт: ["тракт", "Тракт"],
    Микрорайон: ["мкр", "мкр.", "мкр-н", "м-н", "мкрн", "микрорайон", "Микрорайон"],
  };
  const misses: string[] = [];
  for (const [type, list] of Object.entries(forms)) {
    for (const form of list) {
      const samples = [
        `${form} Примерная, 5`,
        `${form}.Примерная, 5`,
        `Примерная ${form}, 5`,
        `Примерная, ${form}, д. 5`,
        `г. Минск, ${form} Примерная, д. 5а, Минск, Беларусь`,
      ];
      for (const sample of samples) {
        const query = addressLookupQueries(sample, "Минск")[0] ?? "";
        const recognized = query.startsWith(`${type} Примерная`) || query.startsWith(`Примерная ${type}`);
        if (!recognized) misses.push(`${sample} => ${query}`);
      }
    }
  }
  assert.deepEqual(misses, []);
  assert.equal(addressLookupQueries("Пр. Держинского , д.16")[0], "Проспект Дзержинского, 16");
  assert.equal(addressLookupQueries("А. Гаруна, 5 СШ №41 Якубовского, 52б", "Минск")[0], "Гаруна, 5, Минск");
  assert.ok(addressLookupQueries("А. Гаруна, 5 СШ №41 Якубовского, 52б", "Минск").includes("Якубовского, 52\u0411, Минск"));
  assert.equal(addressLookupQueries("дворца тенниса на Победителей", "Минск")[0], "дворец тенниса, Минск");
  assert.equal(addressLookupQueries("ФК «Дельта»", "Брест")[0], "Дельта, Брест");
  assert.equal(addressLookupQueries("В. Хоружей 25/2", "Минск")[0], "Хоружей, 25/2, Минск");
});

test("addressHitScore accepts the same street and rejects the city alone", () => {
  assert.ok(addressHitScore("проспект Независимости, 32А", {
    street: "проспект Независимости, 32А",
    displayName: "проспект Независимости, 32А, Минск, Беларусь",
    city: "Минск",
  }) > addressHitScore("проспект Независимости, 32А", {
    street: "проспект Независимости, 95",
    displayName: "проспект Независимости, 95, Минск, Беларусь",
    city: "Минск",
  }));
  assert.equal(addressHitScore("Минск", {
    street: "Минск",
    displayName: "Минск, Беларусь",
    city: "Минск",
  }), 0);
  assert.equal(addressHitScore("проспект Независимости, 32", {
    street: "улица Сурганова, 32",
    displayName: "улица Сурганова, 32, Минск, Беларусь",
    city: "Минск",
  }), 0);
  assert.equal(addressHitScore("переулок Козлова, 3", {
    street: "улица Козлова, 3",
    displayName: "3, улица Козлова, Минск, Беларусь",
    city: "Минск",
  }), 0);
  assert.ok(addressHitScore("переулок Козлова, 3", {
    street: "переулок Козлова, 3",
    displayName: "3, переулок Козлова, Минск, Беларусь",
    city: "Минск",
  }) > 0);
  assert.ok(addressHitScore("Сурганова, 4A", {
    street: "улица Сурганова, 4\u0410",
    displayName: "4\u0410, улица Сурганова, Минск, Беларусь",
    city: "Минск",
  }) > addressHitScore("Сурганова, 4A", {
    street: "улица Сурганова, 4",
    displayName: "4, улица Сурганова, Минск, Беларусь",
    city: "Минск",
  }));
  assert.ok(addressHitScore("Дворец спорта", {
    street: "проспект Победителей, 4",
    displayName: "Дворец спорта, проспект Победителей, 4, Минск, Беларусь",
    city: "Минск",
  }) > 0);
});

test("a street abbreviation is a specific address and a practice word is not", () => {
  assert.equal(isSpecificAddress("пр Независимости, 32А"), true);
  assert.equal(isSpecificAddress("практика"), false);
  assert.equal(isSpecificAddress("проспект"), true);
});
