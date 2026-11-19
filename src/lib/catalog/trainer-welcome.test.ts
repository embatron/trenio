import assert from "node:assert/strict";
import test from "node:test";

import { parseInstagramHandle } from "@/lib/catalog/trainer-welcome";

test("a post link is not an Instagram profile handle", () => {
  assert.equal(parseInstagramHandle("https://instagram.com/p/AbCdEf"), null);
  assert.equal(parseInstagramHandle("https://instagram.com/name/reels"), null);
  assert.equal(parseInstagramHandle("https://www.instagram.com/Shum_Ann/?hl=ru"), "Shum_Ann");
});
