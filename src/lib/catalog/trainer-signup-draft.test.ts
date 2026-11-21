import assert from "node:assert/strict";
import test from "node:test";

import { parseTrainerSignupDraft } from "./trainer-signup-draft";

const sports = [{ slug: "boks", parentSlug: "edinoborstva", label: "Бокс" }];

test("an older draft without the extra card fields still opens", () => {
  const draft = parseTrainerSignupDraft(JSON.stringify({
    bio: "<p>Тренер</p>",
    sports,
    city: "Минск",
    formats: ["individual"],
    audiences: ["adult"],
  }));
  assert.equal(draft?.headline, "");
  assert.equal(draft?.photos.length, 0);
  assert.equal(draft?.phone, "");
  assert.equal(draft?.places.length, 0);
});

test("a phone that is not a Belarus mobile is dropped, and a jpeg stays", () => {
  const draft = parseTrainerSignupDraft(JSON.stringify({
    bio: "<p>Тренер</p>",
    sports,
    city: "Минск",
    formats: ["individual"],
    audiences: ["adult"],
    phone: "+375 29 123-45-67",
    photos: ["data:image/jpeg;base64,abc", "https://example.test/a.jpg"],
    priceFrom: 40,
  }));
  assert.equal(draft?.phone, "+375 29 123-45-67");
  assert.deepEqual(draft?.photos, ["data:image/jpeg;base64,abc"]);
  assert.equal(draft?.priceFrom, 40);
});
