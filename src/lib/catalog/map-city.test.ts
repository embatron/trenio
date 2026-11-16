import assert from "node:assert/strict";
import test from "node:test";

import { BELARUS_CITIES } from "./city-taxonomy";
import { MAP_FRAME_CITY_CAP, mapFrameCities } from "./map-city";

const minsk = { south: 53.82, west: 27.4, north: 53.98, east: 27.72 };
const neighborhood = { south: 53.925, west: 27.59, north: 53.94, east: 27.62 };

test("a chosen catalog city stays the list city", () => {
  assert.deepEqual(mapFrameCities("минск", { south: 52, west: 23, north: 56, east: 33 }), ["Минск"]);
  assert.deepEqual(mapFrameCities("не город", minsk), []);
});

test("a city center inside the frame keeps that city", () => {
  assert.deepEqual(mapFrameCities("", minsk), ["Минск"]);
});

test("a wide frame keeps every city center it holds", () => {
  const cities = mapFrameCities("", { south: 51.2, west: 23.1, north: 56.2, east: 32.8 });
  assert.ok(cities.includes("Минск"));
  assert.ok(cities.includes("Гомель"));
  assert.ok(cities.length > 1);
});

test("a zoomed neighborhood uses the city of the trainers in the frame", () => {
  assert.deepEqual(mapFrameCities("", neighborhood), []);
  assert.deepEqual(mapFrameCities("", neighborhood, ["минск"]), ["Минск"]);
});

test("a chosen small city keeps trainers who have no street", () => {
  assert.deepEqual(mapFrameCities("Марьина Горка", minsk), ["Марьина Горка"]);
  assert.deepEqual(mapFrameCities("щучин", neighborhood), ["Щучин"]);
});

test("a precise pin in a small city keeps that city", () => {
  assert.deepEqual(mapFrameCities("", neighborhood, ["Щучин"]), ["Щучин"]);
});

test("one frame keeps at most 50 cities", () => {
  const cities = mapFrameCities("", neighborhood, [...BELARUS_CITIES]);
  assert.equal(cities.length, MAP_FRAME_CITY_CAP);
  assert.ok(cities.includes("Марьина Горка"));
});
