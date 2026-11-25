import assert from "node:assert/strict";
import test from "node:test";

import { planTrainerWelcome, shouldSendPublishWelcome } from "./welcome-publish";

test("a confirmed draft with an owner gets one welcome when it is published", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "published",
    hasOwner: true,
    confirmed: true,
  }), true);
});

test("a new confirmed card created straight into the catalog gets the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: null,
    next: "published",
    hasOwner: true,
    confirmed: true,
  }), true);
});

test("confirming the owner of a card that is already published sends the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "published",
    next: "published",
    hasOwner: true,
    confirmed: true,
    ownerAttached: true,
  }), true);
});

test("publishing an unconfirmed card does not send the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "published",
    hasOwner: true,
    confirmed: false,
  }), false);
  assert.equal(shouldSendPublishWelcome({
    previous: "published",
    next: "published",
    hasOwner: true,
    confirmed: false,
    ownerAttached: true,
  }), false);
});

test("a published card that is saved again does not send another welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "published",
    next: "published",
    hasOwner: true,
    confirmed: true,
  }), false);
});

test("showing a hidden card again does not send the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "hidden",
    next: "published",
    hasOwner: true,
    confirmed: true,
  }), false);
});

test("an empty card thread is dropped and the letter stays one portal dialog", () => {
  assert.deepEqual(planTrainerWelcome([
    { id: "card", portal: false, messages: 0 },
    { id: "welcome", portal: true, messages: 1 },
  ]), { create: false, conversationId: null, dropIds: ["card"] });
});

test("the first letter is written into an empty portal thread", () => {
  assert.deepEqual(planTrainerWelcome([
    { id: "welcome", portal: true, messages: 0 },
    { id: "card", portal: false, messages: 0 },
  ]), { create: false, conversationId: "welcome", dropIds: ["card"] });
});

test("a dialog that already has messages does not gain a second welcome", () => {
  assert.deepEqual(planTrainerWelcome([
    { id: "card", portal: false, messages: 2 },
  ]), { create: false, conversationId: null, dropIds: [] });
});

test("no thread yet means one new portal letter", () => {
  assert.deepEqual(planTrainerWelcome([]), { create: true, conversationId: null, dropIds: [] });
});

test("a draft with no owner and a card that stays hidden do not send the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "published",
    hasOwner: false,
    confirmed: true,
  }), false);
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "hidden",
    hasOwner: true,
    confirmed: true,
  }), false);
});
