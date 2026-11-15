import assert from "node:assert/strict";
import test from "node:test";

import { leadCityNames } from "./search-city";

const hints = ["Минск", "Гомель", "Гродно", "Витебск", "Могилёв"];

test("the visitor city leads the filter chips", () => {
  assert.deepEqual(leadCityNames(["Гродно"], hints), ["Гродно", "Минск", "Гомель", "Витебск", "Могилёв"]);
  assert.deepEqual(leadCityNames([], hints), hints);
  assert.deepEqual(leadCityNames(["Слуцк"], hints), ["Слуцк", "Минск", "Гомель", "Гродно", "Витебск"]);
});
