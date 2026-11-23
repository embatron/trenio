import assert from "node:assert/strict";
import test from "node:test";

import { cabinetEntryAdmit } from "./cabinet-entry-admit";
import { cabinetEntryState, deskStayClosed } from "./cabinet-entry-state";

const now = new Date("2026-11-22T12:00:00.000Z");
const live = {
  useCount: 0,
  expiresAt: new Date("2026-11-29T12:00:00.000Z"),
  now,
  userStatus: "active",
  ownerUserId: "user-1",
  entryUserId: "user-1",
  profileId: "card-1",
  entryProfileId: "card-1",
};

test("a fresh cabinet link is live for that owner", () => {
  assert.equal(cabinetEntryState(live), "live");
});

test("an open does not close the cabinet link", () => {
  assert.equal(cabinetEntryState({ ...live, useCount: 2 }), "live");
});

test("a replaced cabinet link stays closed", () => {
  assert.equal(cabinetEntryState({ ...live, useCount: 3 }), "used");
});

const person = { purpose: "", fetchDest: "document", fetchMode: "navigate" };

test("the Instagram app opens the cabinet and a preview does not", () => {
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "Mozilla/5.0 Instagram 456.0.0.0", ip: "87.252.227.25" }), "open");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1", ip: "46.53.133.177" }), "open");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", ip: "173.252.87.35" }), "preview");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36", ip: "173.252.82.112" }), "preview");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36", ip: "66.220.149.15" }), "preview");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "Mozilla/5.0 Instagram 456", ip: "87.252.227.25", purpose: "prefetch" }), "preview");
  assert.equal(cabinetEntryAdmit({ ...person, userAgent: "", ip: "87.252.227.25" }), "preview");
});

test("a week-old cabinet link is expired", () => {
  assert.equal(cabinetEntryState({ ...live, expiresAt: now }), "expired");
});

test("Ivan's used cabinet link stays closed", () => {
  assert.equal(deskStayClosed("elsakov_ivan", "live"), "used");
  assert.equal(deskStayClosed("natali.osanka", "live"), "live");
});

test("a cabinet link does not open a different card", () => {
  assert.equal(cabinetEntryState({ ...live, ownerUserId: "user-2" }), "mismatch");
  assert.equal(cabinetEntryState({ ...live, userStatus: "deleted" }), "closed");
});
