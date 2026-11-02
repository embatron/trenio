import assert from "node:assert/strict";
import test from "node:test";

import { GOD_EMAIL, GOD_USER_ID, isGodLogin } from "./god";

test("the owner login stays on its own mailbox", () => {
  assert.equal(GOD_USER_ID, "00000000-0000-0000-0000-000000000000");
  assert.equal(GOD_EMAIL, "embatron@gmail.com");
  assert.equal(isGodLogin("embatron"), true);
  assert.equal(isGodLogin("embatron@gmail.com"), true);
  assert.equal(isGodLogin("trenioby@gmail.com"), false);
  assert.equal(isGodLogin("trenioby"), false);
});
