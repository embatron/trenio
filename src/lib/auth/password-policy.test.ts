import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loginSchema } from "@/lib/auth/schemas";
import { passwordMeterScore, validatePasswordStrength } from "@/lib/auth/password-policy";

describe("password policy", () => {
  test("accepts a long uncommon password without a digit or a capital", () => {
    assert.equal(validatePasswordStrength("река-мост-осень"), null);
    assert.equal(passwordMeterScore("река-мост-осень"), 3);
  });

  test("rejects a short password, a huge password, and a known password", () => {
    assert.match(validatePasswordStrength("short") ?? "", /минимум 8/i);
    assert.match(validatePasswordStrength("a".repeat(129)) ?? "", /128/);
    assert.match(validatePasswordStrength("password") ?? "", /известный/);
    assert.match(validatePasswordStrength("Password") ?? "", /известный/);
    assert.equal(passwordMeterScore("password"), 1);
  });

  test("the login field stops at 128 characters", () => {
    const password = "a".repeat(129);
    const parsed = loginSchema.safeParse({ email: "person@example.com", password });
    assert.equal(parsed.success, false);
  });
});
