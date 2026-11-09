import assert from "node:assert/strict";
import test from "node:test";

import { similarTrainers, type PublishedTrainer } from "./published-trainers";

function trainer(slug: string, sports: Array<[string, string]>): PublishedTrainer {
  const listed = sports.map(([sport, parent]) => ({ slug: sport, parentSlug: parent, label: sport }));
  return {
    slug,
    name: slug,
    firstName: slug,
    lastName: "",
    photo: "",
    city: { slug: "minsk", label: "Минск" },
    sports: listed,
    primarySport: listed[0] ?? { slug: "", parentSlug: "", label: "" },
    bio: "",
    audiences: ["adult"],
    formats: [],
    phone: "",
    instagram: "",
    telegram: "",
    email: "",
    experience: 0,
    priceFrom: 0,
    district: "",
  };
}

test("similar trainers come from the current card categories, same sport first", () => {
  const kickboxer = trainer("kick", [["kikboksing", "edinoborstva"]]);
  const catalog = [
    trainer("yoga", [["yoga", "yoga"]]),
    trainer("boxer", [["boks", "edinoborstva"]]),
    trainer("other-kick", [["kikboksing", "edinoborstva"]]),
    kickboxer,
  ];
  assert.deepEqual(similarTrainers(catalog, kickboxer).map((item) => item.slug), ["other-kick", "boxer"]);
});

test("a card in two categories draws similar trainers from both", () => {
  const both = trainer("both", [["yoga", "yoga"], ["boks", "edinoborstva"]]);
  const catalog = [
    trainer("swim", [["plavanie", "plavanie"]]),
    trainer("yogi", [["yoga", "yoga"]]),
    trainer("boxer", [["boks", "edinoborstva"]]),
    both,
  ];
  assert.deepEqual(similarTrainers(catalog, both).map((item) => item.slug), ["yogi", "boxer"]);
});

test("a card without a category has no similar trainers", () => {
  const empty = trainer("empty", []);
  assert.deepEqual(similarTrainers([empty, trainer("yoga", [["yoga", "yoga"]])], empty), []);
});

test("similar trainers stay at three", () => {
  const kick = trainer("kick", [["kikboksing", "edinoborstva"]]);
  const catalog = ["a", "b", "c", "d"].map((slug) => trainer(slug, [["kikboksing", "edinoborstva"]]));
  assert.equal(similarTrainers([kick, ...catalog], kick).length, 3);
});
