import assert from "node:assert/strict";
import test from "node:test";

import { isActiveTrainer, isDraftQueue, keptUnclearHold, staysUnclear } from "@/lib/admin/trainers";
import { isStaff } from "@/lib/auth/roles";
import { OWN_PROFILE_STATUSES, holdsUnverifiedPublish, keptPageStatus } from "@/lib/catalog/trainer-own";

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
  const visited = door.toISOString();
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
  assert.equal(staysUnclear({ status: "published", doorEnteredAt: visited, trusted: false }), true);
  assert.equal(staysUnclear({ status: "draft", doorEnteredAt: visited, trusted: false }), true);
  assert.equal(staysUnclear({ status: "hidden", doorEnteredAt: visited, trusted: false }), true);
  assert.equal(staysUnclear({ status: "published", doorEnteredAt: visited, trusted: true }), false);
  assert.equal(staysUnclear({ status: "published", doorEnteredAt: "", trusted: false }), false);
  assert.equal(staysUnclear({ status: "declined", doorEnteredAt: visited, trusted: false }), false);
  assert.equal(isActiveTrainer({ status: "published", trusted: true }), true);
  assert.equal(isActiveTrainer({ status: "published", trusted: false }), false);
  assert.equal(isActiveTrainer({ status: "hidden", trusted: true }), false);
  assert.equal(isDraftQueue({ status: "draft", doorEnteredAt: "" }), true);
  assert.equal(isDraftQueue({ status: "draft", doorEnteredAt: visited }), false);
  assert.equal(isDraftQueue({ status: "published", doorEnteredAt: "" }), false);
});

test("a trainer cannot choose moderation or a refusal", () => {
  assert.deepEqual([...OWN_PROFILE_STATUSES], ["published", "hidden", "archived"]);
});

test("an unconfirmed yes waits for staff instead of entering the catalog", () => {
  assert.equal(holdsUnverifiedPublish("published", false), true);
  assert.equal(holdsUnverifiedPublish("published", true), false);
  assert.equal(holdsUnverifiedPublish("hidden", false), false);
});
