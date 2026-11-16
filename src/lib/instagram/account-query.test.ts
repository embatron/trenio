import assert from "node:assert/strict";
import test from "node:test";

import { adminSearchTokens, instagramAccountNeedle } from "./account-query.ts";

test("a pasted Instagram profile becomes the account name", () => {
  assert.equal(instagramAccountNeedle("https://www.instagram.com/via_1705_/"), "via_1705_");
  assert.equal(instagramAccountNeedle("https://instagram.com/via_1705_?hl=ru"), "via_1705_");
  assert.equal(instagramAccountNeedle("@via_1705_"), "via_1705_");
  assert.equal(instagramAccountNeedle("via_1705_"), "via_1705_");
});

test("a name stays a name", () => {
  assert.equal(instagramAccountNeedle("Иван"), null);
  assert.deepEqual(adminSearchTokens("Иван Верле"), ["иван", "верле"]);
});

test("a profile URL in a longer query keeps the other words", () => {
  assert.deepEqual(
    adminSearchTokens("тренер https://www.instagram.com/via_1705_/"),
    ["тренер", "via_1705_"],
  );
});
