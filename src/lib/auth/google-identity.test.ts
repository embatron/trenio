import assert from "node:assert/strict";
import test from "node:test";

import { readGoogleIdentity } from "@/lib/auth/google-identity";

const CLIENT = "client.apps.googleusercontent.com";
const NOW = Date.parse("2026-11-02T12:00:00Z");

function claims(extra: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT,
    exp: Math.floor(NOW / 1000) + 60,
    email_verified: true,
    email: "Person@Gmail.com",
    sub: "1040200300",
    given_name: "Анна",
    ...extra,
  };
}

test("a verified Google mail becomes a lowercase identity", () => {
  const identity = readGoogleIdentity(claims(), CLIENT, NOW);
  assert.deepEqual(identity, { sub: "1040200300", email: "person@gmail.com", name: "Анна" });
});

test("an unverified or foreign token is refused", () => {
  assert.equal(readGoogleIdentity(claims({ email_verified: false }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ aud: "other" }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ exp: Math.floor(NOW / 1000) - 5 }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ iss: "https://evil.example" }), CLIENT, NOW), null);
});
