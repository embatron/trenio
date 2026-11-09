import assert from "node:assert/strict";
import test from "node:test";

import { coverPosition } from "@/lib/images/variants";

test("a wide photo stays centered and a tall photo keeps the top", () => {
  assert.equal(coverPosition(1200, 896, 320, 400), "centre");
  assert.equal(coverPosition(1080, 1600, 320, 400), "north");
  assert.equal(coverPosition(800, 800, 128, 128), "centre");
  assert.equal(coverPosition(0, 0, 320, 400), "centre");
});
