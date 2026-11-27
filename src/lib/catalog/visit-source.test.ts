import assert from "node:assert/strict";
import test from "node:test";

import { visitSource, visitSourceLine } from "./visit-source";

test("a visit source follows the mark we set, then the previous address", () => {
  assert.equal(visitSource({ referrer: "", src: "" }), "direct");
  assert.equal(visitSource({ referrer: "https://www.google.by/search?q=бокс" }), "search");
  assert.equal(visitSource({ referrer: "https://yandex.by/search/" }), "search");
  assert.equal(visitSource({ referrer: "https://mail.google.com/mail/" }), "other");
  assert.equal(visitSource({ referrer: "https://l.instagram.com/" }), "instagram");
  assert.equal(visitSource({ referrer: "https://www.instagram.com/trenioby/" }), "instagram");
  assert.equal(visitSource({ referrer: "https://vk.com/wall1" }), "social");
  assert.equal(visitSource({ referrer: "https://t.me/trenioby" }), "chat");
  assert.equal(visitSource({ referrer: "https://web.telegram.org/a/" }), "chat");
  assert.equal(visitSource({ referrer: "https://wa.me/375291112233" }), "chat");
  assert.equal(visitSource({ referrer: "http://trenio.local/categories/boks" }), "catalog");
  assert.equal(visitSource({ referrer: "https://trenio.by/map" }), "catalog");
  assert.equal(visitSource({ referrer: "https://trenio.by/account/messages?conversation=1" }), "chat");
  assert.equal(visitSource({ referrer: "https://example.com/blog" }), "other");
  assert.equal(visitSource({ referrer: "https://www.google.by/", src: "instagram" }), "instagram");
  assert.equal(visitSource({ referrer: "https://www.google.by/", src: "nope" }), "search");
});

test("the cabinet line names only the sources that happened", () => {
  assert.equal(visitSourceLine([]), "");
  assert.equal(visitSourceLine([
    { source: "catalog", count: 12 },
    { source: "search", count: 0 },
    { source: "instagram", count: 2 },
  ]), "каталог — 12, Instagram — 2");
});
