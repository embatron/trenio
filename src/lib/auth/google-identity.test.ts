import assert from "node:assert/strict";
import test from "node:test";

import { mergeGoogleProfile, readGoogleIdentity } from "@/lib/auth/google-identity";

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
  assert.deepEqual(identity, {
    sub: "1040200300",
    email: "person@gmail.com",
    name: "Анна",
    lastName: "",
    avatarUrl: null,
  });
});

test("Google keeps the family name and a larger portrait", () => {
  const identity = readGoogleIdentity(claims({
    family_name: "Коваль",
    picture: "https://lh3.googleusercontent.com/a-/abc=s96-c",
  }), CLIENT, NOW);
  assert.equal(identity?.lastName, "Коваль");
  assert.equal(identity?.avatarUrl, "https://lh3.googleusercontent.com/a-/abc=s200-c");
  assert.equal(readGoogleIdentity(claims({ picture: "https://evil.example/a.jpg" }), CLIENT, NOW)?.avatarUrl, null);
});

test("Google splits a full name and accepts the surname from userinfo", () => {
  const identity = readGoogleIdentity(claims({ given_name: undefined, name: "Евгений Соколов" }), CLIENT, NOW);
  assert.equal(identity?.name, "Евгений");
  assert.equal(identity?.lastName, "Соколов");
  const merged = mergeGoogleProfile(claims({ given_name: "Анна", name: "" }), {
    sub: "1040200300",
    family_name: "Коваль",
  });
  assert.equal(readGoogleIdentity(merged, CLIENT, NOW)?.lastName, "Коваль");
  assert.equal(mergeGoogleProfile(claims(), { sub: "other", family_name: "Чужая" }).family_name, undefined);
});

test("an unverified or foreign token is refused", () => {
  assert.equal(readGoogleIdentity(claims({ email_verified: false }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ aud: "other" }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ exp: Math.floor(NOW / 1000) - 5 }), CLIENT, NOW), null);
  assert.equal(readGoogleIdentity(claims({ iss: "https://evil.example" }), CLIENT, NOW), null);
});
