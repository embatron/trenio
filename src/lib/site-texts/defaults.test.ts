import assert from "node:assert/strict";
import test from "node:test";

import { reviewTextLength } from "@/lib/catalog/review-html";
import {
  DEFAULT_USER_WELCOME,
  parseUserWelcome,
  renderTrainerWelcome,
  userWelcomePartCount,
} from "./defaults";

test("the trainer letter keeps the saved words and the telegram link", () => {
  const html = renderTrainerWelcome("Владимир", "Здравствуй, {hello}\n\nЖдём тебя. {telegram}");
  const plain = html.replace(/<[^>]+>/g, " ");
  assert.match(plain, /Здравствуй, Владимир, привет!/);
  assert.match(plain, /Ждём тебя/);
  assert.match(html, /href="https:\/\/t\.me\/TrenioByBot"/);
  assert.ok(reviewTextLength(html) <= 4000);
});

test("the user letter is the confirmation mail, in four parts", () => {
  const letter = parseUserWelcome(DEFAULT_USER_WELCOME);
  assert.equal(letter.title, "Подтвердите почту");
  assert.equal(letter.lead, "Остался один шаг, чтобы пользоваться trenio.by.");
  assert.equal(letter.button, "Подтвердить почту");
  assert.match(letter.note, /сутки/);
  assert.equal(letter.subject, "Подтвердите почту trenio.by");
  assert.equal(userWelcomePartCount("один\n---\nдва"), 2);
});
