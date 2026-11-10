import assert from "node:assert/strict";
import test from "node:test";

import {
  compactBelarusPhone,
  isPhoneSignature,
  isStandInAccountName,
  maskedBelarusPhone,
  phoneSignatureName,
} from "@/lib/auth/phone-label";

test("a confirmed Belarus mobile signs and displays as a phone", () => {
  assert.equal(compactBelarusPhone("+375 29 851-67-45"), "+375298516745");
  assert.equal(maskedBelarusPhone("375298516745"), "+37529.....45");
  assert.equal(maskedBelarusPhone("+375 29 835-37-51"), "+37529.....51");
  assert.equal(compactBelarusPhone("+79037659418"), "");
  assert.equal(maskedBelarusPhone(""), "");
  assert.equal(isPhoneSignature("+37529.....51"), true);
  assert.equal(isPhoneSignature("Анна"), false);
});

test("a phone signature replaces only a stand-in name", () => {
  assert.equal(phoneSignatureName("Пользователь", "+375298516745"), "+37529.....45");
  assert.equal(phoneSignatureName("", "+375298516745"), "+37529.....45");
  assert.equal(phoneSignatureName("+37529.....51", "+375298516745"), "+37529.....45");
  assert.equal(phoneSignatureName("+37529.....45", "+375298516745"), null);
  assert.equal(phoneSignatureName("Анна", "+375298516745"), null);
  assert.equal(isStandInAccountName("Пользователь"), true);
  assert.equal(isStandInAccountName("+37529.....45"), true);
  assert.equal(isStandInAccountName("Анна"), false);
});
