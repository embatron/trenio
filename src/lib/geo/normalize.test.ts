import assert from "node:assert/strict";
import test from "node:test";

import { isSpecificAddress } from "@/lib/geo/schemas";
import { addressHitScore, addressLookupQueries, expandStreetQuery, normalizeQuery, sanitizeQuery } from "@/lib/geo/normalize";

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
});

test("expandStreetQuery unfolds a street abbreviation and leaves a full word", () => {
  assert.equal(expandStreetQuery("пр.Дзержинского"), "проспект Дзержинского");
  assert.equal(expandStreetQuery("пр-т.Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("просп.Пушкина"), "проспект Пушкина");
  assert.equal(expandStreetQuery("пр Независимости, 32А"), "проспект Независимости, 32А");
  assert.equal(expandStreetQuery("ул.Олега Кошевого, д. 30"), "улица Олега Кошевого, 30");
  assert.equal(expandStreetQuery("вул. Сурганава 5"), "улица Сурганава 5");
  assert.equal(expandStreetQuery("г. Минск, праспект Пераможцаў"), "Минск, проспект Пераможцаў");
  assert.equal(expandStreetQuery("проспект Независимости"), "проспект Независимости");
  assert.equal(expandStreetQuery("шоссе"), "шоссе");
  assert.equal(expandStreetQuery("Городская"), "Городская");
});

test("addressLookupQueries drops a building suffix and adds a Russian street name", () => {
  assert.deepEqual(addressLookupQueries("пр Независимости, 32А, стр. 2"), [
    "проспект Независимости, 32А",
    "Независимости, 32А",
  ]);
  assert.ok(addressLookupQueries("вул. Незалежнасці, 10").includes("улица Независимости, 10"));
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
