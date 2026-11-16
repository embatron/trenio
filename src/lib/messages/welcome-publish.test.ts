import assert from "node:assert/strict";
import test from "node:test";

import { shouldSendPublishWelcome } from "./welcome-publish";

test("a draft with an owner gets one welcome when it is published", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "published",
    hasOwner: true,
  }), true);
});

test("a new card created straight into the catalog gets the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: null,
    next: "published",
    hasOwner: true,
  }), true);
});

test("attaching the owner to a card that is already published sends the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "published",
    next: "published",
    hasOwner: true,
    ownerAttached: true,
  }), true);
});

test("a published card that is saved again does not send another welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "published",
    next: "published",
    hasOwner: true,
  }), false);
});

test("showing a hidden card again does not send the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "hidden",
    next: "published",
    hasOwner: true,
  }), false);
});

test("a draft with no owner and a card that stays hidden do not send the welcome", () => {
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "published",
    hasOwner: false,
  }), false);
  assert.equal(shouldSendPublishWelcome({
    previous: "draft",
    next: "hidden",
    hasOwner: true,
  }), false);
});
