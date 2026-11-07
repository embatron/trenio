import assert from "node:assert/strict";
import test from "node:test";

import { doorAccountName } from "@/lib/catalog/trainer-door-claim";

test("a new trainer keeps the card name and an empty card keeps the provider name", () => {
  assert.deepEqual(doorAccountName(true, { firstName: "Дверь", lastName: "Яндекс" }), {
    firstName: "Дверь",
    lastName: "Яндекс",
    lastSignupIntent: "trainer_claim",
  });
  assert.deepEqual(doorAccountName(true, { firstName: "Пользователь", lastName: "" }), {
    lastSignupIntent: "trainer_claim",
  });
  assert.deepEqual(doorAccountName(false, { firstName: "Дверь", lastName: "Яндекс" }), {});
});
