import assert from "node:assert/strict";
import test from "node:test";

import { contactAttempts, openedShare, contactShare, pulseStory, trainerNextStep, type PulseStoryTrainer } from "./trainer-pulse-story";

const period = { current: 0, previous: 0 };

function trainer(patch: Partial<PulseStoryTrainer> = {}): PulseStoryTrainer {
  return {
    pageStatus: "published",
    verified: true,
    emailVerified: true,
    phoneVerified: true,
    telegramVerified: true,
    createdSource: "import",
    email: "coach@example.com",
    phone: "+375 29 111-11-11",
    instagram: "https://instagram.com/coach",
    telegram: "https://t.me/coach",
    headline: "Тренер",
    bio: "О себе",
    about: "В зале",
    sportSlugs: ["boxing"],
    city: "Минск",
    experienceYears: 5,
    formats: ["individual"],
    priceFrom: 40,
    places: [{ address: "улица Сурганова, 2" }],
    certificates: [{ path: "/doc.pdf" }],
    ...patch,
  };
}

test("contact attempts add the four channels for the chosen period", () => {
  const attempts = contactAttempts({
    phone: { day: period, week: { current: 2, previous: 1 }, month: period },
    instagram: { day: period, week: { current: 1, previous: 0 }, month: period },
    telegram: { day: period, week: { current: 0, previous: 4 }, month: period },
    message: { day: period, week: { current: 3, previous: 1 }, month: period },
  }, "week");
  assert.deepEqual(attempts, { current: 6, previous: 6 });
});

test("the story says each count once and keeps the comparison in the sentence", () => {
  const lines = pulseStory(
    "week",
    { current: 60, previous: 44 },
    { current: 20, previous: 16 },
    { current: 5, previous: 4 },
  );
  assert.deepEqual(lines.map((line) => `${line.before}${line.emphasis}${line.after}`), [
    "За неделю карточку в списках показали 60 раз — на 16 больше, чем на прошлой неделе.",
    "Страницу открыли 20 раз — на 4 больше, чем на прошлой неделе.",
    "К телефону, Instagram, Telegram или «Написать» перешли 5 раз — на 1 больше, чем на прошлой неделе.",
  ]);
  assert.match(lines[0].note, /браузер/);
  assert.match(lines[0].note, /избранное/i);
  assert.match(lines[1].note, /полчаса/);
  assert.match(lines[1].note, /сотрудника/);
  assert.match(lines[2].note, /три секунды/);
  assert.match(lines[2].note, /Позвонить/);

  const quiet = pulseStory("day", period, period, { current: 0, previous: 2 });
  assert.equal(`${quiet[0].before}${quiet[0].emphasis}${quiet[0].after}`, "За сутки карточку в списках не показали. Вчера тоже.");
  assert.equal(`${quiet[2].before}${quiet[2].emphasis}${quiet[2].after}`, "К телефону, Instagram, Telegram или «Написать» не перешли — на 2 меньше, чем вчера.");

  const same = pulseStory("month", { current: 3, previous: 3 }, { current: 1, previous: 1 }, period);
  assert.match(`${same[0].before}${same[0].emphasis}${same[0].after}`, /столько же, сколько в прошлом месяце/);
  assert.match(`${same[1].emphasis}`, /1 раз/);
});

test("shares stay quiet when the earlier step is empty or a direct open skips the catalog", () => {
  assert.equal(openedShare(4, 0), "");
  assert.equal(openedShare(8, 5), "");
  assert.equal(openedShare(5, 20), "25% открыли карточку");
  assert.equal(contactShare(1, 0), "");
  assert.equal(contactShare(1, 4), "25% перешли к контакту");
});

test("the next step asks for missing contacts and the other empty fields", () => {
  assert.equal(trainerNextStep(trainer({ pageStatus: "draft" }))?.hash, "trainer-page-status");
  assert.equal(trainerNextStep(trainer({ verified: false, emailVerified: false, phoneVerified: false }))?.to, "/me/settings");
  assert.equal(trainerNextStep(trainer()), null);
  const both = trainerNextStep(trainer({
    telegram: "",
    telegramVerified: false,
    priceFrom: null,
    places: [{ address: "зал Атлант" }],
  }));
  assert.equal(both?.hash, "trainer-contact-block");
  assert.equal(both?.text, "Добавьте и подтвердите Telegram. Заполните цену и улицу.");
  assert.equal(
    trainerNextStep(trainer({ phone: "+375 29 111-11-11", phoneVerified: false }))?.text,
    "Подтвердите телефон.",
  );
  assert.equal(trainerNextStep(trainer({ priceFrom: null }))?.hash, "trainer-work");
  assert.equal(trainerNextStep(trainer({ email: "pending.00000000-0000-4000-8000-000000000000@users.trenio.invalid", emailVerified: false }))?.text, "Добавьте и подтвердите почту.");
});
