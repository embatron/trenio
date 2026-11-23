import assert from "node:assert/strict";
import test from "node:test";

import { adminDigestText, adminStatValue } from "@/lib/telegram/published-digest";

test("a positive admin count keeps the plus and zero stays plain", () => {
  assert.equal(adminStatValue(0), "0");
  assert.equal(adminStatValue(4), "+4");
});

test("the admin note opens with the Minsk date", () => {
  const when = new Date("2026-11-18T07:00:00.000Z");
  assert.equal(
    adminDigestText({ published: 4, publishedTotal: 84, chats: 1, reviews: 0, contactClicks: 2, applications: 2 }, when),
    [
      "Админские статы за 18.11.26",
      "",
      "Тренеров опубликовано: +4 (всего 84)",
      "Открыто внутренних чатов: +1",
      "Отзывов написано: 0",
      "Переходов по контактам: +2",
      "Новых заявок от тренеров: +2",
    ].join("\n"),
  );
});
