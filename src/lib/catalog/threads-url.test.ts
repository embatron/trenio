import assert from "node:assert/strict";
import test from "node:test";

import { canonicalThreadsUrl, threadsLabel } from "@/lib/catalog/threads-url";

test("a handle and a profile URL become the same Threads address", () => {
  const expected = "https://www.threads.com/@coach.name";
  assert.equal(canonicalThreadsUrl("@coach.name"), expected);
  assert.equal(canonicalThreadsUrl("coach.name"), expected);
  assert.equal(canonicalThreadsUrl("https://www.threads.net/@coach.name/"), expected);
  assert.equal(canonicalThreadsUrl("https://threads.com/@coach.name"), expected);
  assert.equal(threadsLabel(expected), "@coach.name");
});

test("an empty Threads field clears the contact", () => {
  assert.equal(canonicalThreadsUrl("  "), "");
});

test("a post, another site, or a bare word is refused", () => {
  assert.equal(canonicalThreadsUrl("https://www.threads.net/@coach.name/post/abc"), null);
  assert.equal(canonicalThreadsUrl("https://instagram.com/coach.name"), null);
  assert.equal(canonicalThreadsUrl("http://www.threads.com/@coach.name"), null);
  assert.equal(canonicalThreadsUrl("@"), null);
  assert.equal(canonicalThreadsUrl("..."), null);
});
