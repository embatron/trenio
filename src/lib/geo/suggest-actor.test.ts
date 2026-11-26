import assert from "node:assert/strict";
import test from "node:test";

import { suggestActorKey } from "@/lib/geo/suggest-actor";

test("a signed-in person is counted by account, a guest by the trusted IP", () => {
  assert.equal(suggestActorKey("user-1", "203.0.113.8"), "user:user-1");
  assert.equal(suggestActorKey("  ", "203.0.113.8"), "ip:203.0.113.8");
  assert.equal(suggestActorKey(null, null), "ip:unknown");
  assert.equal(suggestActorKey(null, " 203.0.113.9 "), "ip:203.0.113.9");
});
