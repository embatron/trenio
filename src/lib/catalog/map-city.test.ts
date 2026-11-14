import assert from "node:assert/strict";
import test from "node:test";

import { mapConsideredCity } from "./map-city";

const minsk = { south: 53.82, west: 27.4, north: 53.98, east: 27.72 };

test("a chosen catalog city stays the list city", () => {
  assert.equal(mapConsideredCity("минск", { south: 52, west: 23, north: 56, east: 33 }), "Минск");
  assert.equal(mapConsideredCity("не город", minsk), null);
});

test("one city center in the frame is that city", () => {
  assert.equal(mapConsideredCity("", minsk), "Минск");
});

test("a wide frame with several city centers is not one city", () => {
  assert.equal(mapConsideredCity("", { south: 51.2, west: 23.1, north: 56.2, east: 32.8 }), null);
});
