import assert from "node:assert/strict";
import test from "node:test";

import { parseDeviceRegister } from "@/lib/mobile/device-body";
import { optionalOpenPath, safeOpenPath } from "@/lib/mobile/paths";
import { appleClaimsOk } from "@/lib/mobile/apple-claims";
import { sha256Fingerprints } from "@/lib/mobile/well-known";

const ROUNDS = 20_000;

test(`mobile rules stay under a second for ${ROUNDS} rounds`, () => {
  const token = `${"ab".repeat(16)}${"cd".repeat(16)}`;
  const started = performance.now();
  let kept = 0;
  for (let i = 0; i < ROUNDS; i += 1) {
    if (safeOpenPath(i % 5 === 0 ? "https://evil.example" : `/trainers/n${i}`) !== "https://evil.example") kept += 1;
    optionalOpenPath(i % 7 === 0 ? "//evil.example" : "/map");
    parseDeviceRegister({ token: token.slice(0, 64), platform: "ios", tokenType: "apns", deviceName: "iPhone" });
    appleClaimsOk({
      iss: "https://appleid.apple.com",
      aud: "by.trenio.app",
      exp: 2_000_000_000,
      sub: "001234.abcdef",
    }, 1_900_000_000, "by.trenio.app");
    sha256Fingerprints(token);
  }
  const elapsed = performance.now() - started;
  assert.equal(kept, ROUNDS);
  assert.ok(elapsed < 1000, `load pass took ${elapsed.toFixed(0)} ms`);
});
