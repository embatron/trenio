import assert from "node:assert/strict";
import test from "node:test";

import { deletedAccountEmail, ownedMediaPath, withoutTrainerReplies } from "./delete-account";

const owner = {
  userId: "11111111-1111-4111-8111-111111111111",
  slugs: ["coach.name"],
  handles: ["coach.name"],
};

test("deleted account email does not keep the old mailbox", () => {
  const email = deletedAccountEmail(owner.userId);
  assert.equal(email, `deleted.${owner.userId}@users.trenio.invalid`);
  assert.equal(email.includes("@gmail.com"), false);
});

test("owned media stays inside this account and this card", () => {
  assert.equal(ownedMediaPath(`/avatars/${owner.userId}.jpg?v=1`, owner), `/avatars/${owner.userId}.jpg`);
  assert.equal(ownedMediaPath(`/trainers/self/${owner.userId}.jpg`, owner), `/trainers/self/${owner.userId}.jpg`);
  assert.equal(
    ownedMediaPath("/trainers/admin/coach.name/photos/face-c320.jpg", owner),
    "/trainers/admin/coach.name/photos/face.jpg",
  );
  assert.equal(ownedMediaPath("/trainers/instagram/coach.name-c640.jpg", owner), "/trainers/instagram/coach.name.jpg");
  assert.equal(ownedMediaPath("/trainers/instagram/coach.name2.jpg", owner), null);
  assert.equal(ownedMediaPath("/trainers/admin/other/photos/a.jpg", owner), null);
  assert.equal(ownedMediaPath("/avatars/other.jpg", owner), null);
  assert.equal(ownedMediaPath("/trainers/instagram/../coach.name.jpg", owner), null);
});

test("trainer replies drop out of a review thread", () => {
  const kept = withoutTrainerReplies([
    { role: "author", body: "Хорошо", at: "2026-01-01" },
    { role: "trainer", body: "Спасибо", at: "2026-01-02" },
  ]);
  assert.deepEqual(kept, [{ role: "author", body: "Хорошо", at: "2026-01-01" }]);
  assert.deepEqual(withoutTrainerReplies(null), []);
});
