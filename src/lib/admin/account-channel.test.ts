import assert from "node:assert/strict";
import test from "node:test";

import { confirmedAccountValue } from "./account-channel.ts";

test("a confirmed mailbox is the account value, without a channel label", () => {
  assert.equal(confirmedAccountValue({
    email: "coach@nick.trenio.by",
    emailVerifiedAt: "2026-05-01T10:00:00.000Z",
    phone: "",
    phoneVerifiedAt: null,
  }), "coach");
});

test("a confirmed mobile is the account value when the mailbox is still a placeholder", () => {
  assert.equal(confirmedAccountValue({
    email: "pending@signup.trenio.by",
    emailVerifiedAt: null,
    phone: "+375291112233",
    phoneVerifiedAt: "2026-05-02T10:00:00.000Z",
  }), "+375 29 111-22-33");
});

test("both channels keep the one that confirmed the account first", () => {
  assert.equal(confirmedAccountValue({
    email: "anna@example.com",
    emailVerifiedAt: "2026-04-01T10:00:00.000Z",
    phone: "+375291112233",
    phoneVerifiedAt: "2026-05-02T10:00:00.000Z",
  }), "anna@example.com");
  assert.equal(confirmedAccountValue({
    email: "anna@example.com",
    emailVerifiedAt: "2026-06-01T10:00:00.000Z",
    phone: "+375291112233",
    phoneVerifiedAt: "2026-05-02T10:00:00.000Z",
  }), "+375 29 111-22-33");
});

test("an account with nothing confirmed has no value", () => {
  const empty = {
    email: "",
    emailVerifiedAt: null,
    phone: "",
    phoneVerifiedAt: null,
  };
  assert.equal(confirmedAccountValue(empty), "");
  assert.equal(confirmedAccountValue(null), "");
});
