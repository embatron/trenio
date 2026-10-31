import assert from "node:assert/strict";
import test from "node:test";

import { accountNick, mailboxForNick, resolveAccountLogin } from "@/lib/auth/login-name";

test("trenioby nick points at the gmail mailbox", () => {
  assert.equal(mailboxForNick("Trenioby"), "trenioby@gmail.com");
  assert.equal(mailboxForNick("trenioby@gmail.com"), null);
  assert.equal(resolveAccountLogin("trenioby"), "trenioby@nick.trenio.by");
  assert.equal(accountNick("trenioby@gmail.com"), "trenioby");
  assert.equal(accountNick("coach@nick.trenio.by"), "coach");
  assert.equal(accountNick("embatron@gmail.com"), "embatron");
});
