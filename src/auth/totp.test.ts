import assert from "node:assert/strict";
import test from "node:test";

import { decodeBase32, encodeBase32, hotpCode, openSecret, sealSecret, totpMatches } from "./totp";

test("totp accepts the current counter and rejects a distant one", () => {
  const secret = Buffer.from("12345678901234567890");
  const now = 1_700_000_000_000;
  const code = hotpCode(secret, Math.floor(now / 1000 / 30));
  assert.equal(totpMatches(secret, code, now), true);
  assert.equal(totpMatches(secret, code, now + 5 * 60_000), false);
  assert.equal(encodeBase32(decodeBase32(encodeBase32(secret))).startsWith(encodeBase32(secret).slice(0, 8)), true);
});

test("the stored authenticator secret round-trips", () => {
  const sealed = sealSecret("JBSWY3DPEHPK3PXP");
  assert.equal(openSecret(sealed), "JBSWY3DPEHPK3PXP");
  assert.equal(openSecret("nope"), null);
});
