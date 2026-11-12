import assert from "node:assert/strict";
import test from "node:test";

import { letterWaitMs, PRESENCE_AWAY_MS, PRESENCE_ONLINE_MS, presenceState } from "@/lib/messages/presence";

const now = 1_700_000_000_000;

test("a visible tab from the last minute is online", () => {
  assert.equal(presenceState({ now, lastSeenAt: now - 10_000, visible: true }), "online");
  assert.equal(presenceState({ now, lastSeenAt: now - PRESENCE_ONLINE_MS, visible: true }), "online");
});

test("a hidden tab or a visit inside ten minutes is away", () => {
  assert.equal(presenceState({ now, lastSeenAt: now - 5_000, visible: false }), "away");
  assert.equal(presenceState({ now, lastSeenAt: now - PRESENCE_ONLINE_MS - 1, visible: true }), "away");
  assert.equal(presenceState({ now, lastSeenAt: now - PRESENCE_AWAY_MS, visible: false }), "away");
});

test("no report, or a report older than ten minutes, is offline", () => {
  assert.equal(presenceState({ now, lastSeenAt: null, visible: false }), "offline");
  assert.equal(presenceState({ now, lastSeenAt: now - PRESENCE_AWAY_MS - 1, visible: true }), "offline");
  assert.equal(presenceState({ now, lastSeenAt: now - PRESENCE_AWAY_MS - 1, visible: false }), "offline");
});

test("a letter waits unless the person is offline", () => {
  assert.equal(letterWaitMs("online"), 60_000);
  assert.equal(letterWaitMs("away"), 60_000);
  assert.equal(letterWaitMs("offline"), null);
});
