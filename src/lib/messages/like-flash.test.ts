import assert from "node:assert/strict";
import { test } from "node:test";

import { freshReactionIds, patchMessageReaction, reactionSnapshot } from "@/lib/messages/like-flash";

const row = (id: number, liked: boolean, peerLiked = false) => ({ id, liked, peerLiked });

test("the first paint and a newly loaded row do not blink", () => {
  const page = [row(4, true), row(5, false)];
  assert.deepEqual(freshReactionIds(null, page), []);
  const seen = reactionSnapshot(page);
  assert.deepEqual(freshReactionIds(seen, [row(3, true), ...page]), []);
});

test("a mark that turns on blinks once", () => {
  const seen = reactionSnapshot([row(5, false), row(6, true)]);
  assert.deepEqual(freshReactionIds(seen, [row(5, true), row(6, true)]), [5]);
  assert.deepEqual(freshReactionIds(seen, [row(5, false, true)]), [5]);
  assert.deepEqual(freshReactionIds(reactionSnapshot([row(5, true)]), [row(5, true)]), []);
  assert.deepEqual(freshReactionIds(seen, [row(0, true), row(5, false)]), []);
});

test("the actor's frame sets liked and the other side sets peerLiked", () => {
  const messages = [row(8, false, false)];
  assert.deepEqual(patchMessageReaction(messages, "me", { messageId: 8, actorId: "me", on: true }), [
    row(8, true, false),
  ]);
  assert.deepEqual(patchMessageReaction(messages, "me", { messageId: 8, actorId: "them", on: true }), [
    row(8, false, true),
  ]);
  assert.deepEqual(patchMessageReaction(messages, "me", { messageId: 9, actorId: "them", on: true }), messages);
});
