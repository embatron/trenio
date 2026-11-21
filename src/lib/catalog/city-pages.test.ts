import assert from "node:assert/strict";
import test from "node:test";

import { menuTopCityColumns } from "./city-pages";

test("the menu keeps the twelve largest cities in two columns of six", () => {
  const [first, second] = menuTopCityColumns();
  assert.deepEqual(first.map((city) => city.name), ["Минск", "Гомель", "Гродно", "Витебск", "Могилёв", "Брест"]);
  assert.deepEqual(second.map((city) => city.name), ["Бобруйск", "Барановичи", "Борисов", "Пинск", "Мозырь", "Лида"]);
});
