import assert from "node:assert/strict";
import test from "node:test";

import { isPlainLikeActor } from "./plain-user-like";

test("the house like belongs to the plain Eugene Sokolov account", () => {
  assert.equal(isPlainLikeActor({ firstName: "Eugene", lastName: "Sokolov", roles: ["user"] }), true);
  assert.equal(isPlainLikeActor({ firstName: " eugene ", lastName: "sokolov", roles: ["user"] }), true);
  assert.equal(isPlainLikeActor({ firstName: "Eugene", lastName: "Sokolov", roles: ["user", "trainer"] }), false);
  assert.equal(isPlainLikeActor({ firstName: "Евгений", lastName: "Соколов", roles: ["user"] }), false);
  assert.equal(isPlainLikeActor({ firstName: "Eugene", lastName: "Sokolov", roles: [] }), false);
});
