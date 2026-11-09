import assert from "node:assert/strict";
import test from "node:test";

import { accountPathForTrainer, deniedCabinetTarget, getPostLoginPath } from "@/lib/auth/roles";
import { destinationAfterAuth } from "@/lib/auth/return-path";
import type { UserRole } from "@/lib/auth/types";

const user: UserRole[] = ["user"];
const trainer: UserRole[] = ["trainer"];
const club: UserRole[] = ["club"];
const admin: UserRole[] = ["admin"];
const superadmin: UserRole[] = ["superadmin"];
const staffTrainer: UserRole[] = ["admin", "trainer"];

test("a plain client returns to the page they left", () => {
  assert.equal(destinationAfterAuth(user, "/trainers/sergey.the.champ", true), "/trainers/sergey.the.champ");
  assert.equal(destinationAfterAuth(user, "/", true), "/");
  assert.equal(destinationAfterAuth(user, null, true), "/");
  assert.equal(destinationAfterAuth(user, "/auth/login", true), "/");
  assert.equal(destinationAfterAuth(trainer, "/trainers/sergey.the.champ", true), "/me");
  assert.equal(destinationAfterAuth(trainer, "/trainers/sergey.the.champ"), "/trainers/sergey.the.champ");
  assert.equal(destinationAfterAuth(trainer, "/me"), "/me");
  assert.equal(destinationAfterAuth(admin, "/map", true), "/admin");
});

test("a client opens the profile after login", () => {
  assert.equal(getPostLoginPath(user), "/account");
  assert.equal(getPostLoginPath(trainer), "/me");
  assert.equal(getPostLoginPath(admin), "/admin");
});

test("a client stays out of the trainer and staff cabinets", () => {
  assert.equal(deniedCabinetTarget("account", user, "/account/reviews"), null);
  assert.equal(deniedCabinetTarget("me", user), "/");
  assert.equal(deniedCabinetTarget("admin", user), "/");
});

test("a trainer stays in /me and cannot open staff pages", () => {
  assert.equal(deniedCabinetTarget("me", trainer), null);
  assert.equal(deniedCabinetTarget("admin", trainer), "/me");
  assert.equal(deniedCabinetTarget("account", trainer, "/account/settings"), "/me/settings");
  assert.equal(deniedCabinetTarget("account", club, "/account/favorites"), "/me/favorites");
  assert.equal(
    deniedCabinetTarget("account", trainer, "/account/messages/11111111-1111-4111-8111-111111111111"),
    "/me/messages/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(accountPathForTrainer("/account/messages", "?trainer=embatron.eth"), "/me/messages?trainer=embatron.eth");
});

test("staff stay in /admin, and a trainer on the same account can still open /me", () => {
  assert.equal(deniedCabinetTarget("admin", admin), null);
  assert.equal(deniedCabinetTarget("admin", superadmin), null);
  assert.equal(deniedCabinetTarget("me", admin), "/admin");
  assert.equal(deniedCabinetTarget("account", admin, "/account/settings"), "/admin");
  assert.equal(deniedCabinetTarget("me", staffTrainer), null);
  assert.equal(deniedCabinetTarget("account", staffTrainer, "/account/reviews"), "/admin");
});
