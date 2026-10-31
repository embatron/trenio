import assert from "node:assert/strict";
import test from "node:test";

import { renderLetter } from "./letter";

test("a letter keeps the person, the words, and a round portrait", () => {
  const letter = renderLetter({
    title: "Новое сообщение",
    lead: "Вам написали.",
    person: { name: "Анна <Шум>", avatarUrl: "/trainers/a.jpg", caption: "Тренер" },
    quote: "Привет\nи ещё строка",
    action: { href: "https://trenio.by/me/messages/1", label: "Открыть" },
  });
  assert.match(letter.html, /Анна &lt;Шум&gt;/);
  assert.match(letter.html, /border-radius:50%/);
  assert.match(letter.html, /\/trainers\/a\.jpg/);
  assert.match(letter.html, /Привет\nи ещё строка|Привет/);
  assert.match(letter.text, /Анна <Шум>/);
  assert.match(letter.text, /https:\/\/trenio\.by\/me\/messages\/1/);
  assert.match(letter.html, /logo-mail\.png/);
  assert.match(letter.html, /alt="trenio\.by"/);
  assert.match(letter.html, />Отписаться</);
  assert.match(letter.text, /Отписаться: /);
  assert.doesNotMatch(letter.html, /<script/i);
});

test("a letter without a photo uses the first letter", () => {
  const letter = renderLetter({
    title: "Код",
    person: { name: "иван" },
    quote: "123456",
  });
  assert.match(letter.html, />И</);
  assert.equal((letter.html.match(/<img /g) ?? []).length, 1);
});

test("a confirmation code is its own bold line", () => {
  const letter = renderLetter({
    title: "Код подтверждения почты",
    code: "482913",
    lines: ["Он действует 10 минут."],
  });
  assert.match(letter.html, /font:700 22px\/1\.2 Arial,sans-serif/);
  assert.match(letter.html, />482913</);
  assert.match(letter.text, /482913/);
  assert.doesNotMatch(letter.html, /Код: 482913/);
  assert.doesNotMatch(letter.html, /Отписаться/);
  assert.doesNotMatch(letter.text, /Отписаться/);
});

test("registration mail has no unsubscribe link", () => {
  const letter = renderLetter({
    service: true,
    title: "Подтвердите почту",
    action: { href: "https://trenio.by/auth/verify?token=test", label: "Подтвердить почту" },
  });
  assert.doesNotMatch(letter.html, /Отписаться/);
  assert.doesNotMatch(letter.text, /Отписаться/);
  assert.match(letter.html, /logo-mail\.png/);
});
