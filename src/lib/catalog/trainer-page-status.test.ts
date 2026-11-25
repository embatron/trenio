import assert from "node:assert/strict";
import test from "node:test";

import { keptPageStatus } from "@/lib/catalog/trainer-own";

test("a profile save leaves moderation and a refusal where staff put them", () => {
  assert.equal(keptPageStatus("draft", "published"), "draft");
  assert.equal(keptPageStatus("declined", "published"), "declined");
  assert.equal(keptPageStatus("hidden", "published"), "published");
  assert.equal(keptPageStatus("archived", "hidden"), "hidden");
  assert.equal(keptPageStatus(undefined, "published"), "published");
});
