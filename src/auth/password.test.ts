import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { describe, test } from "node:test";

import { hashPassword, passwordNeedsRehash, verifyPassword } from "@/auth/password";

const LEGACY = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

describe("password hashes", () => {
  test("a legacy hash still matches and a new hash records the heavier cost", async () => {
    const password = "correct horse battery";
    const salt = randomBytes(16).toString("hex");
    const legacy = scryptSync(password, salt, 64, LEGACY).toString("hex");
    const stored = `scrypt:${salt}:${legacy}`;
    assert.equal(await verifyPassword(password, stored), true);
    assert.equal(await verifyPassword("wrong-password-value", stored), false);
    assert.equal(passwordNeedsRehash(stored), true);

    const fresh = await hashPassword(password);
    assert.match(fresh, /^scrypt:131072:/);
    assert.equal(passwordNeedsRehash(fresh), false);
    assert.equal(await verifyPassword(password, fresh), true);
    assert.equal(await verifyPassword(password, "scrypt:999999:aa:bb"), false);
    assert.equal(await verifyPassword("x".repeat(129), fresh), false);
  });
});
