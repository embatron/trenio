import assert from "node:assert/strict";
import test from "node:test";

import { favoriteStats, periodSpans, statsFromDaily } from "./trainer-periods";

test("a Tuesday week starts on Monday and the month keeps the previous calendar month", () => {
  const spans = periodSpans("2026-11-03");
  assert.deepEqual(spans.day.current, { start: "2026-11-03", end: "2026-11-03" });
  assert.deepEqual(spans.day.previous, { start: "2026-11-02", end: "2026-11-02" });
  assert.deepEqual(spans.week.current, { start: "2026-11-02", end: "2026-11-03" });
  assert.deepEqual(spans.week.previous, { start: "2026-10-26", end: "2026-11-01" });
  assert.deepEqual(spans.month.current, { start: "2026-11-01", end: "2026-11-03" });
  assert.deepEqual(spans.month.previous, { start: "2026-10-01", end: "2026-10-31" });
});

test("daily rows land in the Minsk period they belong to", () => {
  const stats = statsFromDaily(
    [
      { day: "2026-11-03", total: 2 },
      { day: "2026-11-02", total: 1 },
      { day: "2026-10-27", total: 4 },
      { day: "2026-10-15", total: 3 },
    ],
    "2026-11-03",
  );
  assert.deepEqual(stats.day, { current: 2, previous: 1 });
  assert.deepEqual(stats.week, { current: 3, previous: 4 });
  assert.deepEqual(stats.month, { current: 3, previous: 7 });
});

test("a favorite counts on the Minsk day it was added and stays in the current total", () => {
  const today = new Date("2026-11-03T08:00:00+03:00").getTime();
  const yesterday = new Date("2026-11-02T23:30:00+03:00").getTime();
  const lastMonth = new Date("2026-10-15T12:00:00+03:00").getTime();
  const stats = favoriteStats([today, yesterday, lastMonth], "2026-11-03");
  assert.equal(stats.total, 3);
  assert.deepEqual(stats.day, { current: 1, previous: 1 });
  assert.deepEqual(stats.week, { current: 2, previous: 0 });
  assert.deepEqual(stats.month, { current: 2, previous: 1 });
});
