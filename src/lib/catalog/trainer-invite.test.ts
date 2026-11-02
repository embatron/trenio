import assert from "node:assert/strict";
import test from "node:test";

import { inviteMissingLines, trainerInviteMessage, type InviteProfileFacts } from "./trainer-invite";

const door = "https://trenio.by/hi/k4n8pq2w";
const publicUrl = "https://trenio.by/trainers/vladimir";

const empty: InviteProfileFacts = {
  city: "",
  places: [],
  address: "",
  priceFrom: null,
  photo: "",
  sports: 0,
  phone: "",
  about: "",
  bio: "",
  experienceYears: 0,
  formats: 0,
  audiences: 0,
  lastName: "",
};

test("an empty import lists the real gaps, including city, places and price", () => {
  const missing = inviteMissingLines(empty);
  assert.deepEqual(missing.slice(0, 3), ["город", "места, где ты тренируешь", "цена персональных занятий"]);
  const text = trainerInviteMessage({ name: "Владимир", doorUrl: door, publicUrl, published: false, missing });
  assert.match(text, /^Владимир, привет!/);
  assert.match(text, /что смогли взять/);
  assert.match(text, /не ставили/);
  assert.match(text, /— город/);
  assert.match(text, /— места, где ты тренируешь/);
  assert.match(text, /— цена персональных занятий/);
  assert.match(text, /только для тебя/);
  assert.match(text, /пароль в кабинете/);
  assert.equal(text.split(door).length, 2);
  assert.equal(text.includes(publicUrl), false);
});

test("a filled city and price stay out of the checklist", () => {
  const missing = inviteMissingLines({
    ...empty,
    city: "Минск",
    priceFrom: 40,
    places: [{ city: "Минск", district: "", address: "ул. Примерная, 1" }],
  });
  assert.equal(missing.includes("город"), false);
  assert.equal(missing.includes("места, где ты тренируешь"), false);
  assert.equal(missing.includes("цена персональных занятий"), false);
  assert.equal(missing.includes("фото"), true);
  const text = trainerInviteMessage({ name: "Владимир", doorUrl: door, publicUrl, published: false, missing });
  assert.doesNotMatch(text, /— город/);
  assert.match(text, /— фото/);
});

test("a complete profile asks for a look, without a gap list", () => {
  const missing = inviteMissingLines({
    ...empty,
    city: "Минск",
    places: [{ city: "Минск", district: "", address: "ул. Примерная, 1" }],
    priceFrom: 40,
    photo: "/trainers/a.jpg",
    sports: 1,
    phone: "+375 29 123-45-67",
    about: "В зале.",
    bio: "Тренер.",
    experienceYears: 5,
    formats: 1,
    audiences: 1,
    lastName: "Антипенко",
  });
  assert.deepEqual(missing, []);
  const text = trainerInviteMessage({ name: "Владимир", doorUrl: door, publicUrl, published: false, missing });
  assert.match(text, /всё ли на месте/);
  assert.doesNotMatch(text, /— /);
});

test("a saved instagram text replaces the default wording", () => {
  const text = trainerInviteMessage({
    name: "Владимир",
    doorUrl: door,
    publicUrl,
    published: false,
    missing: ["фото"],
    template: "Новый текст, {hello}\n{gaps}\n{doorUrl}",
  });
  assert.match(text, /^Новый текст, Владимир, привет!/);
  assert.match(text, /— фото/);
  assert.match(text, new RegExp(door.replace(/[.]/g, "\\.")));
});

test("a published invite points at the catalog page", () => {
  const text = trainerInviteMessage({ name: "", doorUrl: door, publicUrl, published: true, missing: ["город"] });
  assert.match(text, /^Привет!/);
  assert.match(text, /уже опубликован/);
  assert.match(text, /Статус публикации меняешь ты/);
  assert.doesNotMatch(text, /только администратор/);
  assert.equal(text.split(publicUrl).length, 2);
  assert.equal(text.includes(door), false);
  assert.doesNotMatch(text, /— город/);
});
