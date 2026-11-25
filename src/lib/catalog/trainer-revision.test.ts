import assert from "node:assert/strict";
import test from "node:test";

import { revisionChanges } from "./trainer-revision";

test("revision keeps only the fields whose visible text changed", () => {
  const changes = revisionChanges(
    { bio: "<p>Было</p>", status: "черновик", phone: "" },
    { bio: "<p>Стало</p>", status: "черновик", phone: "+375291112233" },
  );
  assert.deepEqual(changes.map((change) => change.key), ["bio", "phone"]);
  assert.equal(changes[0]?.before, "Было");
  assert.equal(changes[0]?.after, "Стало");
  assert.equal(changes[0]?.long, true);
  assert.equal(changes[1]?.label, "Телефон");
});

test("a new card lists filled fields and skips empty seeds", () => {
  const changes = revisionChanges(
    {},
    { bio: "<p>Текст</p>", experience: "0", verified: "нет", firstName: "Дима", status: "черновик" },
  );
  assert.deepEqual(changes.map((change) => change.key), ["status", "firstName", "bio"]);
  assert.equal(changes[0]?.before, "");
  assert.equal(changes[2]?.after, "Текст");
});

test("a dropped older snapshot has no invented diff", () => {
  assert.deepEqual(revisionChanges(null, { bio: "Текст" }), []);
});

test("clearing a field stays visible", () => {
  const changes = revisionChanges({ headline: "Был заголовок" }, { headline: "" });
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.before, "Был заголовок");
  assert.equal(changes[0]?.after, "");
});
