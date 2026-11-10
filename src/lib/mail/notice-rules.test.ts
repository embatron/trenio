import assert from "node:assert/strict";
import test from "node:test";

import { renderLetter } from "./letter";
import {
  ACCOUNT_CLOSED_LETTER,
  browserLabel,
  canReceiveMailbox,
  isNewBrowserLogin,
  messageMailAllowed,
  messageTelegramNoticeAllowed,
  NEW_BROWSER_LETTER,
  profileStatusNotice,
  reviewReplyAudience,
  telegramThreadButton,
  trainerTelegramNoticeAllowed,
} from "./notice-rules";

const verified = new Date("2026-01-01T00:00:00.000Z");

test("a message letter needs a verified mailbox and the switch", () => {
  assert.equal(canReceiveMailbox("person@example.com", verified), true);
  assert.equal(canReceiveMailbox("person@example.com", null), false);
  assert.equal(canReceiveMailbox("pending.11111111-1111-4111-8111-111111111111@users.trenio.invalid", verified), false);
  assert.equal(
    messageMailAllowed({ email: "person@example.com", emailVerifiedAt: verified, allowsMessages: true }),
    true,
  );
  assert.equal(
    messageMailAllowed({ email: "person@example.com", emailVerifiedAt: verified, allowsMessages: false }),
    false,
  );
  assert.equal(
    messageMailAllowed({ email: "person@example.com", emailVerifiedAt: null, allowsMessages: true }),
    false,
  );
});

test("a message telegram notice needs the chat id and a bot the person already opened", () => {
  assert.equal(messageTelegramNoticeAllowed({ telegramUserId: 42, botSeenAt: verified }), true);
  assert.equal(messageTelegramNoticeAllowed({ telegramUserId: null, botSeenAt: verified }), false);
  assert.equal(messageTelegramNoticeAllowed({ telegramUserId: 42, botSeenAt: null }), false);
});

test("trainer telegram notice needs the card, the chat id, and a bot the person already opened", () => {
  const ready = {
    isProfileOwner: true,
    telegramUserId: 42,
    telegramVerifiedAt: verified,
    botSeenAt: verified,
  };
  assert.equal(trainerTelegramNoticeAllowed(ready), true);
  assert.equal(trainerTelegramNoticeAllowed({ ...ready, isProfileOwner: false }), false);
  assert.equal(trainerTelegramNoticeAllowed({ ...ready, telegramUserId: null }), false);
  assert.equal(trainerTelegramNoticeAllowed({ ...ready, telegramVerifiedAt: null }), false);
  assert.equal(trainerTelegramNoticeAllowed({ ...ready, botSeenAt: null }), false);
});

test("the telegram button opens the mini app on https and a plain link otherwise", () => {
  const secure = telegramThreadButton("https://trenio.by/me/messages/abc");
  assert.equal(secure?.inline_keyboard[0]?.[0]?.text, "Открыть переписку");
  assert.deepEqual(secure?.inline_keyboard[0]?.[0]?.web_app, { url: "https://trenio.by/me/messages/abc" });
  const local = telegramThreadButton("http://trenio.local/me/messages/abc");
  assert.equal(local?.inline_keyboard[0]?.[0]?.url, "http://trenio.local/me/messages/abc");
  assert.equal(telegramThreadButton("/me/messages/abc"), null);
});

test("a new browser is a different agent while another session is still open", () => {
  assert.equal(isNewBrowserLogin({ incomingUserAgent: "", liveUserAgents: ["Chrome"] }), false);
  assert.equal(isNewBrowserLogin({ incomingUserAgent: "Chrome", liveUserAgents: [] }), false);
  assert.equal(isNewBrowserLogin({ incomingUserAgent: "Chrome", liveUserAgents: ["Chrome"] }), false);
  assert.equal(isNewBrowserLogin({ incomingUserAgent: " Firefox ", liveUserAgents: ["Chrome"] }), true);
  assert.equal(browserLabel("  Mozilla\nFirefox  "), "Mozilla Firefox");
});

test("profile status and review replies name the person who should hear", () => {
  assert.equal(profileStatusNotice("draft", "draft"), null);
  assert.deepEqual(profileStatusNotice("draft", "published"), {
    subject: "Карточка опубликована trenio.by",
    title: "Карточка опубликована",
    lead: "Теперь её видно в каталоге.",
  });
  assert.equal(profileStatusNotice("published", "hidden")?.title, "Карточка скрыта");
  assert.equal(profileStatusNotice("published", "archived")?.lead, "В каталоге её больше нет.");
  assert.equal(profileStatusNotice("hidden", "draft")?.title, "Карточка на модерации");
  assert.equal(profileStatusNotice("published", "mystery"), null);
  assert.equal(reviewReplyAudience("trainer"), "author");
  assert.equal(reviewReplyAudience("author"), "owner");
});

test("a notice is the same HTML letter as the rest of the site", () => {
  const letter = renderLetter({
    service: true,
    title: NEW_BROWSER_LETTER.title,
    lead: NEW_BROWSER_LETTER.lead,
    person: { name: "Анна Коваль", avatarUrl: "/avatars/anna.jpg" },
    note: NEW_BROWSER_LETTER.note,
    action: { href: "https://trenio.by/mail", label: NEW_BROWSER_LETTER.actionLabel },
  });
  assert.match(letter.html, /logo-mail\.png/);
  assert.match(letter.html, /border-radius:50%/);
  assert.match(letter.html, /Анна Коваль/);
  assert.match(letter.html, /\/avatars\/anna\.jpg/);
  assert.match(letter.text, /В ваш аккаунт вошли с другого браузера/);
  assert.match(letter.text, /Если это были не вы, смените пароль/);
  assert.doesNotMatch(letter.html, />Отписаться</);
  assert.doesNotMatch(letter.text, /сеансов|Браузер:/);

  const review = renderLetter({
    title: "Новый отзыв",
    lead: "Здравствуйте, Иван!",
    person: { name: "Мария", caption: "Клиент" },
    quote: "Спокойные занятия, всё по делу.",
    lines: ["Оценка 5 из 5."],
    action: { href: "https://trenio.by/me/reviews", label: "Открыть отзывы" },
  });
  assert.match(review.html, /logo-mail\.png/);
  assert.match(review.html, />Отписаться</);
  assert.match(review.text, /Спокойные занятия, всё по делу/);
  assert.match(review.text, /Открыть отзывы: https:\/\/trenio\.by\/me\/reviews/);

  const closed = renderLetter({
    service: true,
    title: ACCOUNT_CLOSED_LETTER.title,
    lead: ACCOUNT_CLOSED_LETTER.lead,
    person: { name: "Анна Коваль" },
    lines: [...ACCOUNT_CLOSED_LETTER.lines],
    action: { href: "https://trenio.by/auth/login", label: ACCOUNT_CLOSED_LETTER.actionLabel },
  });
  assert.match(closed.text, /Вы закрыли аккаунт/);
  assert.match(closed.text, /Восстановить аккаунт/);
  assert.doesNotMatch(closed.text, /данные стираются/);
});
