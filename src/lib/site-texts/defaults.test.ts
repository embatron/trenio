import assert from "node:assert/strict";
import test from "node:test";

import { reviewTextLength } from "@/lib/catalog/review-html";
import {
  DEFAULT_INSTAGRAM_MESSAGE,
  DEFAULT_USER_WELCOME,
  OUTREACH_SITE_LINK,
  outreachHello,
  outreachWithSiteLink,
  instagramGaps,
  outreachTemplate,
  parseUserWelcome,
  renderInstagramMessage,
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

test("a changed instagram text is what gets copied, with the door link", () => {
  const text = renderInstagramMessage({
    template: "Привет, {hello}\n{gaps}\n{doorUrl}",
    hello: "Анна, привет!",
    gaps: instagramGaps(["фото"]),
    doorUrl: "https://trenio.by/hi/k4n8pq2w",
  });
  assert.match(text, /Привет, Анна, привет!/);
  assert.match(text, /— фото/);
  assert.match(text, /https:\/\/trenio\.by\/hi\/k4n8pq2w/);
});

test("the first outreach message does not carry the short link", () => {
  assert.match(DEFAULT_INSTAGRAM_MESSAGE, /^\{hello\}/);
  assert.equal(outreachHello("Анна"), "Анна, добрый день!");
  assert.equal(outreachHello("  "), "Добрый день!");
  assert.match(DEFAULT_INSTAGRAM_MESSAGE, /trenio by/);
  assert.equal(DEFAULT_INSTAGRAM_MESSAGE.includes(OUTREACH_SITE_LINK), false);
  const linked = outreachWithSiteLink(DEFAULT_INSTAGRAM_MESSAGE.replaceAll("{hello}", outreachHello("Анна")));
  assert.match(linked, /^Анна, добрый день!/);
  assert.match(linked, /https:\/\/trenio\.by/);
  assert.equal(linked.includes("trenio by"), false);
  assert.equal(linked.includes("/hi/"), false);
  assert.equal(DEFAULT_INSTAGRAM_MESSAGE.includes("{doorUrl}"), false);
  assert.equal(outreachTemplate("{hello}\n{doorUrl}"), DEFAULT_INSTAGRAM_MESSAGE);
});
