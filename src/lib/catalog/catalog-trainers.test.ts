import assert from "node:assert/strict";
import test from "node:test";

import { catalogTrainerFromSources, type CatalogTrainerSource } from "./catalog-trainers";

function source(overrides: Partial<CatalogTrainerSource> = {}): CatalogTrainerSource {
  return {
    slug: "coach",
    firstName: "Анна",
    lastName: "Коуч",
    fullName: "Анна Коуч",
    avatarPath: "",
    photos: ["/trainers/coach.jpg"],
    bio: "Занятия в зале.",
    about: null,
    sports: [{ slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" }],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    audiences: ["adult"],
    formats: ["individual"],
    city: "Минск",
    citySlug: "minsk",
    district: "",
    createdSource: "import",
    address: "",
    trainingPlaces: [],
    certificates: null,
    priceFrom: null,
    experienceYears: 4,
    phone: "+375291112233",
    email: "coach@example.com",
    emailVerifiedAt: null,
    instagramUrl: "",
    instagramHandle: "coach",
    telegram: "@coach",
    telegramVerifiedAt: null,
    ownerUserId: "user-1",
    ...overrides,
  };
}

test("a published catalog card keeps the sport and hides unverified contacts", () => {
  const trainer = catalogTrainerFromSources(source(), {
    email: "owner@example.com",
    emailVerifiedAt: null,
    phone: "+375291112233",
    phoneVerifiedAt: null,
  });
  assert.equal(trainer.city.slug, "minsk");
  assert.equal(trainer.sports[0]?.slug, "kikboksing");
  assert.equal(trainer.sports[0]?.parentSlug, "edinoborstva");
  assert.equal(trainer.photo, "/trainers/coach.jpg");
  assert.equal(trainer.instagram, "https://instagram.com/coach");
  assert.equal(trainer.phone, "");
  assert.equal(trainer.email, "");
  assert.equal(trainer.telegram, "");
});

test("verified phone, telegram, and login email stay on the catalog card", () => {
  const trainer = catalogTrainerFromSources(
    source({ telegramVerifiedAt: new Date("2026-11-03T00:00:00Z"), emailVerifiedAt: new Date("2026-11-03T00:00:00Z") }),
    {
      email: "owner@example.com",
      emailVerifiedAt: new Date("2026-11-03T00:00:00Z"),
      phone: "+375291112233",
      phoneVerifiedAt: new Date("2026-11-03T00:00:00Z"),
    },
  );
  assert.match(trainer.phone, /29/);
  assert.equal(trainer.email, "owner@example.com");
  assert.equal(trainer.telegram, "@coach");
});

test("catalog rank keeps the whole card, including a contact the public page still hides", () => {
  const trainer = catalogTrainerFromSources(
    source({
      about: ["Разминка, техника и работа в парах."],
      address: "улица Сурганова, 32",
      certificates: [{ path: "/trainers/coach-diploma.jpg" }],
    }),
    {
      email: "owner@example.com",
      emailVerifiedAt: null,
      phone: "+375291112233",
      phoneVerifiedAt: null,
    },
  );
  assert.equal(trainer.phone, "");
  assert.equal(trainer.cardFilled, 9);
  assert.equal(trainer.contactsFilled, 4);
});
