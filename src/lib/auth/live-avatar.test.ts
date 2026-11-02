import assert from "node:assert/strict";
import test from "node:test";

import { visibleAvatar } from "./live-avatar";

const USER = "00000000-0000-0000-0000-000000000000";
const OTHER = "7461164d-c06e-424a-88e2-37d9d70e3748";

test("a saved face shows before the session reloads", () => {
  assert.equal(
    visibleAvatar({ userId: USER, src: "/avatars/a.jpg?v=2" }, USER, ""),
    "/avatars/a.jpg?v=2",
  );
});

test("the crop preview shows immediately, ahead of the previous file", () => {
  assert.equal(
    visibleAvatar({ userId: USER, src: "data:image/jpeg;base64,abc" }, USER, "/avatars/a.jpg?v=1"),
    "data:image/jpeg;base64,abc",
  );
});

test("a newer session face wins over an older live file", () => {
  assert.equal(
    visibleAvatar({ userId: USER, src: "/avatars/a.jpg?v=1" }, USER, "/avatars/a.jpg?v=2"),
    "/avatars/a.jpg?v=2",
  );
});

test("another account does not inherit the live face", () => {
  assert.equal(
    visibleAvatar({ userId: OTHER, src: "/avatars/b.jpg?v=9" }, USER, "/avatars/a.jpg?v=1"),
    "/avatars/a.jpg?v=1",
  );
});
