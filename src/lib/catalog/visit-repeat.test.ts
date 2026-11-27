import assert from "node:assert/strict";
import test from "node:test";

import { VISIT_GAP_MS, visitCountsAsNew } from "./visit-repeat";

test("a return after half an hour is a new visit and a reload is not", () => {
  const morning = Date.parse("2026-11-27T08:00:00+03:00");
  assert.equal(visitCountsAsNew(null, morning), true);
  assert.equal(visitCountsAsNew(morning, morning + 10_000), false);
  assert.equal(visitCountsAsNew(morning, morning + VISIT_GAP_MS - 1), false);
  assert.equal(visitCountsAsNew(morning, morning + VISIT_GAP_MS), true);
  assert.equal(visitCountsAsNew(morning, morning + 3 * 60 * 60 * 1000), true);
  assert.equal(visitCountsAsNew(morning, Date.parse("2026-11-27T20:00:00+03:00")), true);
});
