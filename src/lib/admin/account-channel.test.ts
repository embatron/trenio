import assert from "node:assert/strict";
import test from "node:test";

import { accountConfirmations } from "./account-channel.ts";

const empty = { email: "", emailVerified: false, phone: "", phoneVerified: false };

test("a confirmed mailbox is the account, even when the phone is empty", () => {
  const lines = accountConfirmations({
    ...empty,
    email: "coach@example.com",
    emailVerified: true,
    phone: "+375291112233",
  });
  assert.deepEqual(lines, [{ channel: "Почта", value: "coach@example.com" }]);
});

test("a confirmed mobile is enough when the mailbox is still a placeholder", () => {
  const lines = accountConfirmations({
    ...empty,
    email: "pending.00000000-0000-4000-8000-000000000001@users.trenio.invalid",
    phone: "375291112233",
    phoneVerified: true,
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.channel, "Телефон");
  assert.match(lines[0]?.value ?? "", /^\+375 29/);
});

test("both confirmed channels stay, mailbox first", () => {
  const lines = accountConfirmations({
    email: "coach@nick.trenio.by",
    emailVerified: true,
    phone: "+375291112233",
    phoneVerified: true,
  });
  assert.deepEqual(lines.map((line) => line.channel), ["Почта", "Телефон"]);
  assert.equal(lines[0]?.value, "coach");
});

test("an account with nothing confirmed lists no channel", () => {
  assert.deepEqual(accountConfirmations(empty), []);
  assert.deepEqual(accountConfirmations(null), []);
});
