import assert from "node:assert/strict";
import test from "node:test";

import { knownWelcomeDestination, ownerLoginEmail, parseInstagramHandle } from "@/lib/catalog/trainer-welcome";

test("a known Instagram goes to the door, the cabinet, login, the public page, or a closed card", () => {
  assert.equal(knownWelcomeDestination({ status: "draft", hasOwner: false, viewerOwns: false }), "door");
  assert.equal(knownWelcomeDestination({ status: "draft", hasOwner: true, viewerOwns: false }), "login");
  assert.equal(knownWelcomeDestination({ status: "draft", hasOwner: true, viewerOwns: true }), "cabinet");
  assert.equal(knownWelcomeDestination({ status: "published", hasOwner: true, viewerOwns: false }), "login");
  assert.equal(knownWelcomeDestination({ status: "published", hasOwner: true, viewerOwns: true }), "cabinet");
  assert.equal(knownWelcomeDestination({ status: "published", hasOwner: false, viewerOwns: false }), "profile");
  assert.equal(knownWelcomeDestination({ status: "hidden", hasOwner: true, viewerOwns: false }), "login");
  assert.equal(knownWelcomeDestination({ status: "hidden", hasOwner: false, viewerOwns: false }), "closed");
  assert.equal(knownWelcomeDestination({ status: "archived", hasOwner: false, viewerOwns: true }), "closed");
  assert.equal(knownWelcomeDestination({ status: "archived", hasOwner: true, viewerOwns: false }), "login");
});

test("a post link is not an Instagram profile handle", () => {
  assert.equal(parseInstagramHandle("https://instagram.com/p/AbCdEf"), null);
  assert.equal(parseInstagramHandle("https://instagram.com/name/reels"), null);
  assert.equal(parseInstagramHandle("https://www.instagram.com/Shum_Ann/?hl=ru"), "Shum_Ann");
});

test("the join form shows the owner mailbox and hides an internal or unowned address", () => {
  assert.equal(ownerLoginEmail("user-1", "Owner@Example.com"), "owner@example.com");
  assert.equal(ownerLoginEmail("user-1", "pending.11111111-1111-4111-8111-111111111111@users.trenio.invalid"), null);
  assert.equal(ownerLoginEmail("user-1", "deleted.11111111-1111-4111-8111-111111111111@users.trenio.invalid"), null);
  assert.equal(ownerLoginEmail("user-1", "nick@nick.trenio.by"), null);
  assert.equal(ownerLoginEmail("user-1", "not-an-email"), null);
  assert.equal(ownerLoginEmail(null, "card@example.com"), null);
});
