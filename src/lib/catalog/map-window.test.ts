import assert from "node:assert/strict";
import test from "node:test";

import { MAP_CLUSTER_CAP, MAP_PAGE_SIZE, MAP_PIN_CAP, MAP_TOOLTIP_CAP } from "./map-limits";
import { capMapFeatures, mapPeopleColumns, mapPeopleWindow } from "./map-window";

test("map columns follow the shared card grid", () => {
  assert.equal(mapPeopleColumns(320), 1);
  assert.equal(mapPeopleColumns(359), 1);
  assert.equal(mapPeopleColumns(360), 2);
  assert.equal(mapPeopleColumns(719), 2);
  assert.equal(mapPeopleColumns(720), 3);
  assert.equal(mapPeopleColumns(1280), 3);
});

test("the top of the list mounts the first rows only", () => {
  const window = mapPeopleWindow({
    count: 12,
    columns: 2,
    scrollTop: 0,
    listTop: 400,
    viewHeight: 700,
    rowHeight: 300,
  });
  assert.equal(window.start, 0);
  assert.ok(window.end <= 12);
  assert.ok(window.end > 0);
});

test("ten thousand trainers keep a short mounted window", () => {
  const window = mapPeopleWindow({
    count: 10_000,
    columns: 3,
    scrollTop: 5000,
    listTop: 200,
    viewHeight: 800,
    rowHeight: 300,
    gap: 24,
  });
  assert.equal(window.start % 3, 0);
  assert.ok(window.end - window.start <= 30);
  assert.ok(window.end < 10_000);
  assert.ok(window.height > 1_000_000);
  assert.equal(window.offset, 12 * 324);
  assert.equal(window.start, 36);
  assert.equal(window.end, 60);
});

test("an empty frame mounts nothing", () => {
  assert.deepEqual(
    mapPeopleWindow({ count: 0, columns: 2, scrollTop: 0, listTop: 0, viewHeight: 800, rowHeight: 300 }),
    { start: 0, end: 0, offset: 0, height: 0 },
  );
});

test("one frame stays a page of cards and a capped set of marks", () => {
  assert.equal(MAP_PAGE_SIZE, 12);
  assert.equal(MAP_PIN_CAP, 80);
  assert.equal(MAP_CLUSTER_CAP, 180);
  assert.equal(MAP_TOOLTIP_CAP, 8);
  assert.equal(capMapFeatures(Array.from({ length: 10_000 }, (_, index) => index)).length, MAP_CLUSTER_CAP);
  assert.equal(capMapFeatures([1, 2, 3]).length, 3);
});
