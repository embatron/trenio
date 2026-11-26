import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPulse, CATALOG_PULSE_DAYS, type CatalogPulseInput } from "./catalog-pulse.ts";

const today = "2026-11-26";

function card(patch: Partial<CatalogPulseInput> & Pick<CatalogPulseInput, "slug">): CatalogPulseInput {
  return {
    handle: patch.slug,
    status: "draft",
    city: "",
    createdAt: "2026-11-20T10:00:00+03:00",
    publishedAt: null,
    outreach: false,
    invite: false,
    door: false,
    owned: false,
    verified: false,
    hasPhoto: true,
    hasPrice: true,
    hasPhone: true,
    sport: "",
    ...patch,
  };
}

test("cities are a share of the published cards, and the laptop fixture stays out", () => {
  const pulse = buildCatalogPulse([
    card({ slug: "a", status: "published", city: "Минск", publishedAt: "2026-11-20T10:00:00+03:00" }),
    card({ slug: "b", status: "published", city: "Минск", publishedAt: "2026-11-21T10:00:00+03:00" }),
    card({ slug: "c", status: "published", city: "Гродно", publishedAt: "2026-11-22T10:00:00+03:00" }),
    card({ slug: "d", status: "published", city: "  ", publishedAt: "2026-11-22T12:00:00+03:00" }),
    card({ slug: "e", status: "draft", city: "Минск" }),
    card({ slug: "test-trener", status: "published", city: "Минск", publishedAt: "2026-11-22T12:00:00+03:00" }),
  ], today);
  assert.equal(pulse.publishedTotal, 4);
  assert.deepEqual(pulse.cities.map((city) => [city.label, city.count, city.percent]), [
    ["Минск", 2, 50],
    ["Без города", 1, 25],
    ["Гродно", 1, 25],
  ]);
});

test("each calendar day counts cards added and first publications inside the window", () => {
  const pulse = buildCatalogPulse([
    card({ slug: "old", status: "published", createdAt: "2026-01-02T10:00:00+03:00", publishedAt: "2026-01-02T10:00:00+03:00" }),
    card({ slug: "new", status: "draft", createdAt: "2026-11-26T01:00:00+03:00" }),
    card({ slug: "live", status: "published", createdAt: "2026-11-25T22:00:00+03:00", publishedAt: "2026-11-26T09:00:00+03:00" }),
    card({ slug: "unstamped", status: "published", createdAt: "2026-11-24T15:00:00+03:00", publishedAt: null }),
  ], today);
  assert.equal(pulse.days.length, CATALOG_PULSE_DAYS);
  assert.equal(pulse.days[0]?.day, "2026-08-29");
  assert.equal(pulse.days.at(-1)?.day, today);
  const byDay = new Map(pulse.days.map((day) => [day.day, day]));
  assert.equal(byDay.get("2026-01-02"), undefined);
  assert.equal(byDay.get("2026-11-26")?.published, 1);
  assert.equal(byDay.get("2026-11-26")?.added, 1);
  assert.equal(byDay.get("2026-11-25")?.added, 1);
  assert.equal(byDay.get("2026-11-24")?.published, 1);
  assert.equal(byDay.get("2026-11-24")?.added, 1);
  assert.equal(pulse.publishedInWindow, 2);
  assert.equal(byDay.get("2026-11-01")?.month, "ноя");
  assert.equal(byDay.get("2026-11-26")?.month, "ноя");
});

test("status, gaps, and sports describe the cards staff can act on", () => {
  const pulse = buildCatalogPulse([
    card({
      slug: "ready",
      status: "published",
      city: "Минск",
      sport: "ММА",
      outreach: true,
      invite: true,
      door: true,
      owned: true,
      verified: true,
      publishedAt: "2026-11-20T10:00:00+03:00",
    }),
    card({
      slug: "thin",
      status: "published",
      city: "",
      sport: "",
      hasPhoto: false,
      hasPrice: false,
      hasPhone: false,
      publishedAt: "2026-11-21T10:00:00+03:00",
    }),
    card({ slug: "draft", status: "draft", outreach: true }),
  ], today);
  assert.deepEqual(pulse.statuses.map((row) => [row.label, row.count]), [
    ["Опубликованы", 2],
    ["Черновики", 1],
    ["Скрыты", 0],
    ["Сняты", 0],
    ["Отказались", 0],
  ]);
  assert.deepEqual(pulse.gaps.map((row) => row.label), [
    "Без фото",
    "Без цены",
    "Без телефона",
    "Без города",
    "Аккаунт не подтверждён",
    "Без владельца",
  ]);
  assert.equal(pulse.gaps[0]?.count, 1);
  assert.deepEqual(pulse.sports.map((row) => [row.label, row.count]), [
    ["ММА", 1],
    ["Вид не указан", 1],
  ]);
});
