import assert from "node:assert/strict";
import test from "node:test";

import { normalizeQuery, sanitizeQuery } from "@/lib/geo/normalize";

test("sanitizeQuery trims, collapses spaces, and drops short text", () => {
  assert.equal(sanitizeQuery("  Минск   "), "Минск");
  assert.equal(sanitizeQuery("  ул.   Пушкина  12 "), "ул. Пушкина 12");
  assert.equal(sanitizeQuery("ab"), null);
  assert.equal(sanitizeQuery("   "), null);
});

test("normalizeQuery lowercases and strips punctuation", () => {
  assert.equal(normalizeQuery("Минск, ул. Пушкина, 12"), "минск ул пушкина 12");
  assert.equal(normalizeQuery("ab!!"), null);
  assert.equal(normalizeQuery("Минск"), "минск");
});
