import assert from "node:assert/strict";
import test from "node:test";

import { pulseChartSpan, sortPulseChart, type PulseChartPoint } from "./pulse-chart";

const points: PulseChartPoint[] = [
  { day: "2026-11-23", shows: 1, opens: 4, contacts: 0, messages: 2 },
  { day: "2026-11-24", shows: 9, opens: 1, contacts: 3, messages: 0 },
  { day: "2026-11-25", shows: 2, opens: 2, contacts: 1, messages: 5 },
  { day: "2026-11-26", shows: 0, opens: 0, contacts: 0, messages: 0 },
  { day: "2026-11-27", shows: 4, opens: 3, contacts: 2, messages: 1 },
];

test("a missing series stays empty", () => {
  assert.deepEqual(pulseChartSpan(undefined, "week"), []);
  assert.deepEqual(pulseChartSpan([], "month"), []);
});

test("the chart keeps the selected period and can sort a day to the front", () => {
  assert.deepEqual(pulseChartSpan(points, "day").map((point) => point.day), ["2026-11-27"]);
  assert.deepEqual(sortPulseChart(points, "shows").map((point) => point.day), [
    "2026-11-24",
    "2026-11-27",
    "2026-11-25",
    "2026-11-23",
    "2026-11-26",
  ]);
  assert.deepEqual(sortPulseChart(points, "day").map((point) => point.day), points.map((point) => point.day));
});
