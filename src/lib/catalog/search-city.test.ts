import assert from "node:assert/strict";
import test from "node:test";

import { catalogFilterCities, leadCityNames } from "./search-city";

const hints = ["Минск", "Гомель", "Гродно", "Витебск", "Могилёв"];

test("a cleared place does not put Минск back into the filter", () => {
  assert.deepEqual(catalogFilterCities({ cities: [], query: "", source: "cleared" }), []);
  assert.deepEqual(catalogFilterCities({ cities: [], query: "" }), ["Минск"]);
  assert.deepEqual(catalogFilterCities({ cities: ["Гродно"], query: "" }), ["Гродно"]);
});

test("the visitor city leads the filter chips", () => {
  assert.deepEqual(leadCityNames(["Гродно"], hints), ["Гродно", "Минск", "Гомель", "Витебск", "Могилёв"]);
  assert.deepEqual(leadCityNames([], hints), hints);
  assert.deepEqual(leadCityNames(["Слуцк"], hints), ["Слуцк", "Минск", "Гомель", "Гродно", "Витебск"]);
});
