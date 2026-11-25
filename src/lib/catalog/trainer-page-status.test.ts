import assert from "node:assert/strict";
import test from "node:test";

import { keptUnclearHold, staysUnclear } from "@/lib/admin/trainers";
import { isStaff } from "@/lib/auth/roles";
import { holdsUnverifiedPublish, keptPageStatus } from "@/lib/catalog/trainer-own";

test("only staff can publish an unconfirmed card", () => {
  assert.equal(isStaff(["admin"]), true);
  assert.equal(isStaff(["superadmin"]), true);
  assert.equal(isStaff(["admin", "trainer"]), true);
  assert.equal(isStaff(["trainer"]), false);
  assert.equal(isStaff(["club"]), false);
  assert.equal(isStaff(["user"]), false);
  assert.equal(isStaff(["trainer", "user"]), false);
});

test("a profile save leaves moderation and a refusal where staff put them", () => {
  assert.equal(keptPageStatus("draft", "published"), "draft");
  assert.equal(keptPageStatus("declined", "published"), "declined");
  assert.equal(keptPageStatus("hidden", "published"), "published");
  assert.equal(keptPageStatus("archived", "hidden"), "hidden");
  assert.equal(keptPageStatus(undefined, "published"), "published");
});

test("a staff publish keeps an unclear card on that list until the account is confirmed", () => {
  const door = new Date("2026-11-01T00:00:00.000Z");
  assert.equal(keptUnclearHold({
    previousStatus: "draft",
    previousDoor: door,
    previousHold: false,
    nextStatus: "published",
    ready: false,
  }), true);
  assert.equal(keptUnclearHold({
    previousStatus: "draft",
    previousDoor: null,
    previousHold: false,
    nextStatus: "published",
    ready: false,
  }), false);
  assert.equal(keptUnclearHold({
    previousStatus: "draft",
    previousDoor: door,
    previousHold: false,
    nextStatus: "published",
    ready: true,
  }), false);
  assert.equal(staysUnclear({ status: "published", doorEnteredAt: door.toISOString(), unclearHold: true, trusted: false }), true);
  assert.equal(staysUnclear({ status: "published", doorEnteredAt: door.toISOString(), unclearHold: true, trusted: true }), false);
  assert.equal(staysUnclear({ status: "draft", doorEnteredAt: door.toISOString(), unclearHold: false, trusted: false }), true);
});

test("an unconfirmed yes waits for staff instead of entering the catalog", () => {
  assert.equal(holdsUnverifiedPublish("published", false), true);
  assert.equal(holdsUnverifiedPublish("published", true), false);
  assert.equal(holdsUnverifiedPublish("hidden", false), false);
});
