import assert from "node:assert/strict";
import test from "node:test";

import { membershipDays } from "@/lib/account/membership";

test("membership days follow the Minsk calendar", () => {
  const created = new Date("2026-11-01T10:00:00.000Z");
  const later = new Date("2026-11-07T10:00:00.000Z");
  assert.equal(membershipDays(created, later), 6);
  assert.equal(membershipDays(later, later), 0);
  assert.equal(membershipDays(later, created), 0);
});
