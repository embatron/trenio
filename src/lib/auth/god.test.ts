import assert from "node:assert/strict";
import test from "node:test";

import { GOD_EMAIL, isGodLogin } from "./god";

test("admin and superadmin share the public mailbox", () => {
  assert.equal(GOD_EMAIL, "trenioby@gmail.com");
  assert.equal(isGodLogin("trenioby@gmail.com"), true);
  assert.equal(isGodLogin("Trenioby"), true);
  assert.equal(isGodLogin("embatron"), true);
  assert.equal(isGodLogin("embatron@gmail.com"), true);
  assert.equal(isGodLogin("coach@example.com"), false);
});
