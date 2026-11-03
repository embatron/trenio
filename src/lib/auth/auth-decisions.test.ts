import assert from "node:assert/strict";
import test from "node:test";

import {
  accountGatePath,
  decideEmailSignup,
  decideGoogleLink,
  decideSmsSignup,
  gateAllowsPath,
} from "./auth-decisions";

test("email signup does not enter an existing mailbox", () => {
  assert.equal(decideEmailSignup("none"), "create");
  assert.equal(decideEmailSignup("unverified"), "refresh");
  assert.equal(decideEmailSignup("verified"), "notice");
  assert.equal(decideEmailSignup("blocked"), "notice");
});

test("a signup SMS cannot enter an account that linked the number later", () => {
  assert.equal(decideSmsSignup({ challengeUserId: null, ownerStillHasPhone: false, phoneIsFree: true }), "create");
  assert.equal(decideSmsSignup({ challengeUserId: null, ownerStillHasPhone: false, phoneIsFree: false }), "refuse");
  assert.equal(decideSmsSignup({ challengeUserId: "user", ownerStillHasPhone: true, phoneIsFree: false }), "login");
  assert.equal(decideSmsSignup({ challengeUserId: "user", ownerStillHasPhone: false, phoneIsFree: true }), "refuse");
});

test("Google takes an unverified row and refuses a different Google id", () => {
  assert.equal(
    decideGoogleLink({ exists: false, blocked: false, emailVerified: false, googleSub: null, incomingSub: "g" }),
    "create",
  );
  assert.equal(
    decideGoogleLink({ exists: true, blocked: false, emailVerified: false, googleSub: null, incomingSub: "g" }),
    "takeover",
  );
  assert.equal(
    decideGoogleLink({ exists: true, blocked: false, emailVerified: true, googleSub: null, incomingSub: "g" }),
    "attach",
  );
  assert.equal(
    decideGoogleLink({ exists: true, blocked: false, emailVerified: true, googleSub: "other", incomingSub: "g" }),
    "refuse",
  );
  assert.equal(
    decideGoogleLink({ exists: true, blocked: true, emailVerified: true, googleSub: null, incomingSub: "g" }),
    "refuse",
  );
});

test("the cabinet stays closed until the missing factor is done", () => {
  assert.equal(accountGatePath(null), null);
  assert.equal(
    accountGatePath({ needsCredentials: true, needsDoorPassword: true, needsTotp: true }),
    "/auth/credentials",
  );
  assert.equal(
    accountGatePath({ needsCredentials: false, needsDoorPassword: true, needsTotp: false }),
    "/auth/password",
  );
  assert.equal(gateAllowsPath("/auth/confirm-email", "/auth/credentials"), true);
  assert.equal(gateAllowsPath("/account/settings", "/auth/credentials"), false);
});
