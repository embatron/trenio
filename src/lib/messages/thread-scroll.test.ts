import assert from "node:assert/strict";
import test from "node:test";

import { firstUnreadMessageId, messageScrollTop, prependedScrollTop, seenMessageId } from "@/lib/messages/thread-scroll";

const thread = [
  { id: 1, mine: false },
  { id: 2, mine: true },
  { id: 3, mine: false },
  { id: 4, mine: false },
];

test("a caught-up thread has no unread anchor", () => {
  assert.equal(firstUnreadMessageId(thread, 4, true), null);
  assert.equal(firstUnreadMessageId(thread, 9, true), null);
});

test("the anchor is the oldest incoming message after the read cursor", () => {
  assert.equal(firstUnreadMessageId(thread, 1, true), 3);
  assert.equal(firstUnreadMessageId(thread, null, true), 1);
});

test("own and pending rows are not an unread anchor", () => {
  assert.equal(firstUnreadMessageId([{ id: -5, mine: true }, { id: 2, mine: true }], null, true), null);
});

test("a staff reader who is not a participant stays at the bottom", () => {
  assert.equal(firstUnreadMessageId(thread, null, false), null);
});

test("a missing read cursor does not treat the whole history as unread", () => {
  assert.equal(firstUnreadMessageId(thread, undefined, true), null);
});

test("a long unread tail opens at the start of the message", () => {
  const place = messageScrollTop({ anchorTop: 900, scrollHeight: 2400, clientHeight: 500 });
  assert.equal(place.top, 892);
  assert.equal(place.stick, false);
});

test("a short unread tail stays pinned to the bottom", () => {
  const place = messageScrollTop({ anchorTop: 1800, scrollHeight: 2100, clientHeight: 500 });
  assert.equal(place.top, 1600);
  assert.equal(place.stick, true);
});

test("a message is read only after its bottom crosses the pane edge", () => {
  const rows = [
    { id: 1, bottom: 200 },
    { id: 2, bottom: 480 },
    { id: 3, bottom: 900 },
  ];
  assert.equal(seenMessageId(rows, 500), 2);
  assert.equal(seenMessageId(rows, 891), 2);
  assert.equal(seenMessageId(rows, 892), 3);
});

test("a message scrolled above the pane stays read", () => {
  assert.equal(seenMessageId([{ id: 4, bottom: -40 }, { id: 5, bottom: 700 }], 400), 4);
});

test("a pending row does not move the read cutoff", () => {
  assert.equal(seenMessageId([{ id: -1, bottom: 100 }, { id: 0, bottom: 100 }], 400), null);
});

test("no unread anchor pins to the bottom", () => {
  const place = messageScrollTop({ anchorTop: null, scrollHeight: 2100, clientHeight: 500 });
  assert.equal(place.top, 1600);
  assert.equal(place.stick, true);
});

test("older messages keep the line that was on screen", () => {
  assert.equal(prependedScrollTop({ scrollTop: 240, previousHeight: 900, nextHeight: 1400 }), 740);
  assert.equal(prependedScrollTop({ scrollTop: 240, previousHeight: 900, nextHeight: 900 }), 240);
});
