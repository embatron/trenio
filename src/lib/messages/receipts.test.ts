import assert from "node:assert/strict";
import test from "node:test";

import { messageReceipt } from "@/lib/messages/receipts";

test("a stored message stays sent until the other client has it", () => {
  assert.equal(messageReceipt(8, null, null), "sent");
  assert.equal(messageReceipt(8, 3, 3), "sent");
});

test("a fetched message is delivered and a seen one is read", () => {
  assert.equal(messageReceipt(8, 3, 9), "delivered");
  assert.equal(messageReceipt(8, 8, 4), "read");
  assert.equal(messageReceipt(8, 9, 9), "read");
});
