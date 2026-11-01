import assert from "node:assert/strict";
import test from "node:test";

import { displayAccountLogin } from "@/lib/auth/login-name";
import { isPendingSignupEmail, isReservedAccountEmail, pendingSignupEmail } from "@/lib/auth/pending-email";

const ID = "11111111-1111-4111-8111-111111111111";

test("a phone signup mailbox is pending until the person saves a real one", () => {
  const email = pendingSignupEmail(ID);
  assert.equal(isPendingSignupEmail(email), true);
  assert.equal(isPendingSignupEmail("person@example.com"), false);
  assert.equal(isReservedAccountEmail(email), true);
  assert.equal(isReservedAccountEmail("coach@nick.trenio.by"), true);
  assert.equal(isReservedAccountEmail("person@example.com"), false);
  assert.equal(displayAccountLogin(email), "не указана");
});
