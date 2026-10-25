import assert from "node:assert/strict";
import test from "node:test";

import { optionalBelarusPhone } from "../catalog/trainer-welcome";
import { normalizeBelarusMobile, storedBelarusPhone } from "./phone";

const STORED = "+375 29 123-45-67";
const DIGITS = "375291234567";

test("every spelling of a Belarus mobile stores one string", () => {
  const spellings = [
    "+375 29 123-45-67",
    "+375291234567",
    "375291234567",
    "375 29 1234567",
    "+375 (29) 123-45-67",
    "8 029 123-45-67",
    "80291234567",
  ];
  for (const raw of spellings) {
    assert.equal(normalizeBelarusMobile(raw), DIGITS);
    assert.equal(storedBelarusPhone(raw), STORED);
    assert.equal(optionalBelarusPhone(raw).phone, STORED);
    assert.equal(optionalBelarusPhone(raw).error, null);
  }
});

test("mobile prefixes 25, 33 and 44 store the same shape", () => {
  assert.equal(storedBelarusPhone("375251112233"), "+375 25 111-22-33");
  assert.equal(storedBelarusPhone("+375 33 637-62-68"), "+375 33 637-62-68");
  assert.equal(storedBelarusPhone("80441234567"), "+375 44 123-45-67");
});

test("a landline, a short number and a foreign number are not stored", () => {
  for (const raw of ["+375 17 123-45-67", "375171234567", "+375", "12345", "+1 202 555 0100", ""]) {
    assert.equal(storedBelarusPhone(raw), null);
    assert.equal(normalizeBelarusMobile(raw), null);
  }
  const landline = optionalBelarusPhone("+375 17 123-45-67");
  assert.equal(landline.phone, null);
  assert.equal(landline.error, "Укажите мобильный номер РБ: +375 25/29/33/44 …");
  assert.deepEqual(optionalBelarusPhone("+375"), { phone: null, error: null });
});
