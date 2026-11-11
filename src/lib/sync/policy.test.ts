import assert from "node:assert/strict";
import test from "node:test";

import { isLocalOnlyTrainer, looksLikeMedia, nextStamp, nextToken, syncAuthorized, trainerFileName } from "./policy";

test("the sync secret must match and stay at least 32 characters", () => {
  const secret = "a".repeat(32);
  assert.equal(syncAuthorized("Bearer " + secret, secret), true);
  assert.equal(syncAuthorized("Bearer " + "b".repeat(32), secret), false);
  assert.equal(syncAuthorized("Bearer short", "short"), false);
  assert.equal(syncAuthorized(null, secret), false);
});

test("an existing message mark is kept and a blank one takes the first timestamp", () => {
  const existing = new Date("2026-01-02T00:00:00.000Z");
  assert.equal(nextStamp(existing, "2026-02-02T00:00:00.000Z"), null);
  assert.equal(nextStamp(null, "not-a-date"), null);
  assert.equal(nextStamp(null, "2026-03-04T05:06:07.000Z")?.toISOString(), "2026-03-04T05:06:07.000Z");
});

test("a short code is stored only when the card has none", () => {
  assert.equal(nextToken("abcdefgh", "23456789"), null);
  assert.equal(nextToken(null, "23456789"), "23456789");
  assert.equal(nextToken(null, "short"), null);
});

test("the local test trainer stays off the sync", () => {
  assert.equal(isLocalOnlyTrainer("test-trener"), true);
  assert.equal(isLocalOnlyTrainer("Test-Trener"), true);
  assert.equal(isLocalOnlyTrainer("testtrener"), true);
  assert.equal(isLocalOnlyTrainer("test_trener"), false);
  assert.equal(isLocalOnlyTrainer("anna"), false);
});

test("a trainer file stays under that handle", () => {
  assert.equal(trainerFileName("alex_bro_training", "alex_bro_training-g2-c320.jpg"), true);
  assert.equal(trainerFileName("shum_ann", "shum_ann.pdf"), true);
  assert.equal(trainerFileName("shum_ann", "../shum_ann.jpg"), false);
  assert.equal(trainerFileName("shum", "shum_ann.jpg"), false);
  assert.equal(looksLikeMedia("a.jpg", Uint8Array.from([0xff, 0xd8, 0xff])), true);
  assert.equal(looksLikeMedia("a.jpg", Uint8Array.from([0x3c, 0x68])), false);
});
