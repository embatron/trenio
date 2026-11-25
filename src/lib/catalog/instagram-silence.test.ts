import assert from "node:assert/strict";
import test from "node:test";

import { isSilentInstagram } from "./instagram-silence";

test("latysheu is closed for import and Instagram letters", () => {
  assert.equal(isSilentInstagram("latysheu"), true);
  assert.equal(isSilentInstagram("@Latysheu"), true);
  assert.equal(isSilentInstagram("https://www.instagram.com/latysheu/"), true);
  assert.equal(isSilentInstagram("https://instagram.com/latysheu?hl=ru"), true);
  assert.equal(isSilentInstagram("anna"), false);
  assert.equal(isSilentInstagram(""), false);
});
