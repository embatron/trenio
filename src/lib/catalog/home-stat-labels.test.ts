import assert from "node:assert/strict";
import test from "node:test";

import { homeStatFrame, homeStatLabels } from "./home-stat-labels";

test("homepage counts use the noun that agrees with the number", () => {
  assert.deepEqual(
    homeStatLabels({ trainers: 1, sports: 1, cities: 1, experience: 1 }).map((item) => item.l),
    ["тренер на платформе", "вид спорта", "город Беларуси", "год среднего стажа"],
  );
  assert.deepEqual(
    homeStatLabels({ trainers: 2, sports: 3, cities: 4, experience: 2 }).map((item) => item.l),
    ["тренера на платформе", "вида спорта", "города Беларуси", "года среднего стажа"],
  );
  assert.deepEqual(
    homeStatLabels({ trainers: 5, sports: 11, cities: 12, experience: 11 }).map((item) => item.l),
    ["тренеров на платформе", "видов спорта", "городов Беларуси", "лет среднего стажа"],
  );
  assert.deepEqual(
    homeStatLabels({ trainers: 21, sports: 22, cities: 21, experience: 21 }).map((item) => item.l),
    ["тренер на платформе", "вида спорта", "город Беларуси", "год среднего стажа"],
  );
});

test("a count starts at zero and lands on the real totals", () => {
  const target = { trainers: 9, sports: 10, cities: 1, experience: 1 };
  assert.deepEqual(homeStatFrame(target, 0), { trainers: 0, sports: 0, cities: 0, experience: 0 });
  assert.deepEqual(homeStatFrame(target, 1), target);
  const mid = homeStatFrame(target, 0.5);
  assert.ok(mid.trainers > 0 && mid.trainers < target.trainers);
  assert.equal(mid.cities, 1);
  assert.equal(homeStatFrame({ ...target, experience: null }, 0.4).experience, null);
});

test("an unknown average experience stays a caption without a year word", () => {
  const row = homeStatLabels({ trainers: 0, sports: 0, cities: 0, experience: null });
  assert.equal(row[3]?.n, "—");
  assert.equal(row[3]?.l, "средний стаж");
  assert.equal(row[0]?.l, "тренеров на платформе");
});
