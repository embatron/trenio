import assert from "node:assert/strict";
import test from "node:test";

import { messageEditable, messageSearchPattern, pickPairThread } from "@/lib/messages/pair";

test("an existing welcome wins over the empty card thread of the same two people", () => {
  const picked = pickPairThread(
    [
      { id: "card", trainerProfileId: "profile", messages: 0, activityAt: 200 },
      { id: "welcome", trainerProfileId: null, messages: 1, activityAt: 100 },
    ],
    "profile",
  );
  assert.deepEqual(picked, { keepId: "welcome", dropIds: ["card"] });
});

test("a sole empty thread is kept", () => {
  const picked = pickPairThread(
    [{ id: "card", trainerProfileId: "profile", messages: 0, activityAt: 1 }],
    "profile",
  );
  assert.equal(picked?.keepId, "card");
  assert.deepEqual(picked?.dropIds, []);
});

test("a message with history is not dropped when another thread is kept", () => {
  const picked = pickPairThread(
    [
      { id: "older", trainerProfileId: "profile", messages: 2, activityAt: 1 },
      { id: "newer", trainerProfileId: null, messages: 4, activityAt: 9 },
    ],
    "profile",
  );
  assert.equal(picked?.keepId, "newer");
  assert.deepEqual(picked?.dropIds, []);
});

test("edit stays open for 15 minutes and then closes", () => {
  const created = "2026-11-11T12:00:00.000Z";
  const start = new Date(created).getTime();
  assert.equal(messageEditable(created, true, false, start + 14 * 60 * 1000), true);
  assert.equal(messageEditable(created, true, false, start + 16 * 60 * 1000), false);
  assert.equal(messageEditable(created, false, false, start + 1000), false);
  assert.equal(messageEditable(created, true, true, start + 1000), false);
});

test("search waits for two characters and escapes like wildcards", () => {
  assert.equal(messageSearchPattern(" a "), null);
  assert.equal(messageSearchPattern("ви"), "%ви%");
  assert.equal(messageSearchPattern("100%"), "%100\\%%");
});
