import assert from "node:assert/strict";
import test from "node:test";

import { MAP_CLUSTER_CAP, MAP_PAGE_SIZE, MAP_PIN_CAP, MAP_TOOLTIP_CAP, mapClusterCellCount, mapClusterStep } from "./map-limits";
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

function cityCloud() {
  const points: Array<{ lat: number; lng: number }> = [];
  for (let row = 0; row < 100; row += 1) {
    for (let column = 0; column < 100; column += 1) {
      points.push({
        lat: 53.84 + (row / 99) * 0.16,
        lng: 27.4 + (column / 99) * 0.28,
      });
    }
  }
  return points;
}

test("zooming out uses a wider cell than a street view", () => {
  assert.ok(mapClusterStep(8, 0) > mapClusterStep(16, 0));
  assert.ok(mapClusterStep(12, 3) > mapClusterStep(12, 0));
  assert.ok(mapClusterStep(16, 0) >= 0.0002);
  assert.ok(mapClusterStep(2, 8) <= 120);
});

test("ten thousand trainers in one city collapse as the frame zooms", () => {
  const points = cityCloud();
  assert.equal(points.length, 10_000);
  const street = mapClusterCellCount(points, 16);
  const district = mapClusterCellCount(points, 12);
  const city = mapClusterCellCount(points, 8);
  assert.ok(street <= MAP_CLUSTER_CAP);
  assert.ok(district <= street);
  assert.ok(city <= district);
  assert.ok(city < 40);
});

test("a spread of a few places stays separate at street zoom", () => {
  const points = [
    { lat: 53.9, lng: 27.55 },
    { lat: 53.91, lng: 27.6 },
    { lat: 53.88, lng: 27.5 },
  ];
  assert.equal(mapClusterCellCount(points, 16), 3);
  assert.equal(mapClusterCellCount(points, 4), 1);
});
