import assert from "node:assert/strict";
import test from "node:test";

import { nextMessageAnnounce, onMessagePage } from "@/lib/messages/notice";

const fresh = { conversationId: "c1", messageId: 4, name: "Анна" };

test("the first snapshot does not toast unread that was already there", () => {
  assert.deepEqual(nextMessageAnnounce(null, fresh, "/"), { seen: 4, announce: false });
  assert.deepEqual(nextMessageAnnounce(null, null, "/"), { seen: 0, announce: false });
});

test("a newer message toasts away from the inbox", () => {
  assert.deepEqual(nextMessageAnnounce(4, { ...fresh, messageId: 5 }, "/trainers/anna"), {
    seen: 5,
    announce: true,
  });
});

test("the same message and an open inbox stay quiet", () => {
  assert.equal(nextMessageAnnounce(5, { ...fresh, messageId: 5 }, "/").announce, false);
  assert.equal(
    nextMessageAnnounce(4, { ...fresh, messageId: 9 }, "/me/messages/c1").announce,
    false,
  );
  assert.equal(
    nextMessageAnnounce(4, { ...fresh, messageId: 9 }, "/account/messages").announce,
    false,
  );
  assert.equal(
    nextMessageAnnounce(4, { ...fresh, messageId: 9 }, "/admin/messages").announce,
    false,
  );
});

test("a read inbox does not move the cursor backwards", () => {
  assert.deepEqual(nextMessageAnnounce(9, null, "/"), { seen: 9, announce: false });
});

test("message routes are the three cabinets", () => {
  assert.equal(onMessagePage("/me/messages"), true);
  assert.equal(onMessagePage("/trainers/messages"), false);
});
