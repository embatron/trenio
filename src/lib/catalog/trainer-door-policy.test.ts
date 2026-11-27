import assert from "node:assert/strict";
import test from "node:test";

import { trainerMagicDoorOpen } from "@/lib/catalog/trainer-door-policy";

const open = {
  previewCookie: "khalilova.fitness",
  slug: "khalilova.fitness",
  previewToken: "ab23cdef",
  claimable: true,
};

test("a catalog visit does not open the confirm controls", () => {
  assert.equal(trainerMagicDoorOpen({ ...open, doorCode: "" }), false);
  assert.equal(trainerMagicDoorOpen({ ...open, doorCode: "othercod" }), false);
});

test("the short link opens the confirm controls", () => {
  assert.equal(trainerMagicDoorOpen({ ...open, doorCode: "ab23cdef" }), true);
  assert.equal(trainerMagicDoorOpen({ ...open, doorCode: "AB23CDEF" }), true);
});

test("the revise page keeps the cookie session", () => {
  assert.equal(trainerMagicDoorOpen(open), true);
  assert.equal(trainerMagicDoorOpen({ ...open, previewCookie: "other" }), false);
  assert.equal(trainerMagicDoorOpen({ ...open, claimable: false }), false);
});
