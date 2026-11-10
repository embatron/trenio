import assert from "node:assert/strict";
import test from "node:test";

import { accountNick, mailboxForNick, mailboxLocalName, resolveAccountLogin, storedGivenName } from "@/lib/auth/login-name";

test("trenioby nick points at the gmail mailbox", () => {
  assert.equal(mailboxForNick("Trenioby"), "trenioby@gmail.com");
  assert.equal(mailboxForNick("trenioby@gmail.com"), null);
  assert.equal(resolveAccountLogin("trenioby"), "trenioby@nick.trenio.by");
  assert.equal(accountNick("trenioby@gmail.com"), "trenioby");
  assert.equal(accountNick("coach@nick.trenio.by"), "coach");
  assert.equal(accountNick("embatron@gmail.com"), "embatron");
});

test("a mailbox without a name signs with the part before @", () => {
  assert.equal(mailboxLocalName("DasaFilon@mail.ru"), "dasafilon");
  assert.equal(mailboxLocalName("pending.11111111-1111-4111-8111-111111111111@users.trenio.invalid"), null);
  assert.equal(mailboxLocalName("deleted.11111111-1111-4111-8111-111111111111@users.trenio.invalid"), null);
  assert.equal(storedGivenName("Пользователь", "dasafilon@mail.ru"), "dasafilon");
  assert.equal(storedGivenName("", "dasafilon@mail.ru"), "dasafilon");
  assert.equal(storedGivenName("Анна", "dasafilon@mail.ru"), "Анна");
  assert.equal(storedGivenName("+37529.....51", "dasafilon@mail.ru"), "+37529.....51");
  assert.equal(storedGivenName("Пользователь", "pending.11111111-1111-4111-8111-111111111111@users.trenio.invalid"), "Пользователь");
});
