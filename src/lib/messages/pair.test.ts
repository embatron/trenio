import assert from "node:assert/strict";
import test from "node:test";

import { messageEditable, messagePersonMatches, messageSearchPattern, pickPairThread, preferClickedProfile } from "@/lib/messages/pair";

test("the clicked card stays open when another thread of the pair has more messages", () => {
  const rows = [
    { id: "other", trainerProfileId: "other-card", messages: 4 },
    { id: "clicked", trainerProfileId: "clicked-card", messages: 0 },
  ];
  assert.deepEqual(preferClickedProfile(rows, "clicked-card").map((row) => row.id), ["clicked"]);
});

test("a pair with no thread for the clicked card stays intact", () => {
  const rows = [{ id: "welcome", trainerProfileId: null, messages: 1 }];
  assert.equal(preferClickedProfile(rows, "clicked-card").length, 1);
});

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

test("a name still matches after a layout swap, a lookalike, a missing space, or a typo", () => {
  const katya = ["Катя", "Лисина"];
  assert.equal(messagePersonMatches("к", katya), false);
  assert.equal(messagePersonMatches("катя", katya), true);
  assert.equal(messagePersonMatches("лисина", katya), true);
  assert.equal(messagePersonMatches("катя лисина", katya), true);
  assert.equal(messagePersonMatches("катялисина", katya), true);
  assert.equal(messagePersonMatches("rfnz", katya), true);
  assert.equal(messagePersonMatches("кати", katya), true);
  assert.equal(messagePersonMatches("актя", katya), true);
  assert.equal(messagePersonMatches("лиcина", katya), true);
  assert.equal(messagePersonMatches("лисиан", katya), true);
  assert.equal(messagePersonMatches("ольга", katya), false);
  assert.equal(messagePersonMatches("морозз", ["Павел", "Мороз"]), true);
  assert.equal(messagePersonMatches("алена", ["Алёна", "Соболь"]), true);
});
