import assert from "node:assert/strict";
import test from "node:test";

import { similarTrainers, trainerBreadcrumbSport, type PublishedTrainer } from "./published-trainers";

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

test("similar trainers stay inside the current card categories", () => {
  const kickboxer = trainer("kick", [["kikboksing", "edinoborstva"]]);
  const catalog = [
    trainer("yoga", [["yoga", "yoga"]]),
    trainer("boxer", [["boks", "edinoborstva"]]),
    trainer("other-kick", [["kikboksing", "edinoborstva"]]),
    kickboxer,
  ];
  assert.deepEqual(similarTrainers(catalog, kickboxer).map((item) => item.slug), ["boxer", "other-kick"]);
});

test("similar trainers follow the personal catalog rank", () => {
  const kickboxer = trainer("kick", [["kikboksing", "edinoborstva"]]);
  const rank: Record<string, number> = { boxer: 80, "other-kick": 20, yoga: 100 };
  const catalog = [
    trainer("yoga", [["yoga", "yoga"]]),
    trainer("other-kick", [["kikboksing", "edinoborstva"]]),
    trainer("boxer", [["boks", "edinoborstva"]]),
    kickboxer,
  ];
  const picked = similarTrainers(catalog, kickboxer, 3, (left, right) => rank[right.slug] - rank[left.slug]);
  assert.deepEqual(picked.map((item) => item.slug), ["boxer", "other-kick"]);
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

test("the sport crumb stays on the first sport until the visit names another sport on the card", () => {
  const card = trainer("andrey", [
    ["mma", "edinoborstva"],
    ["grepling", "edinoborstva"],
    ["dzyudo", "edinoborstva"],
    ["boks", "edinoborstva"],
  ]);
  assert.equal(trainerBreadcrumbSport(card, undefined).slug, "mma");
  assert.equal(trainerBreadcrumbSport(card, "").slug, "mma");
  assert.equal(trainerBreadcrumbSport(card, "mma").slug, "mma");
  assert.equal(trainerBreadcrumbSport(card, "dzyudo").slug, "dzyudo");
  assert.equal(trainerBreadcrumbSport(card, "boks").slug, "boks");
  assert.equal(trainerBreadcrumbSport(card, "edinoborstva").slug, "mma");
  assert.equal(trainerBreadcrumbSport(card, "yoga").slug, "mma");
  assert.equal(trainerBreadcrumbSport(card, " dzyudo ").slug, "dzyudo");
});

test("similar trainers stay at three", () => {
  const kick = trainer("kick", [["kikboksing", "edinoborstva"]]);
  const catalog = ["a", "b", "c", "d"].map((slug) => trainer(slug, [["kikboksing", "edinoborstva"]]));
  assert.equal(similarTrainers([kick, ...catalog], kick).length, 3);
});
