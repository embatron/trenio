import assert from "node:assert/strict";
import test from "node:test";

import { reviewTextLength } from "@/lib/catalog/review-html";
import { PORTAL_TELEGRAM_URL, trainerWelcomeHtml } from "./welcome";

test("the trainer welcome is concise and gives the trainer clear next steps", () => {
  const html = trainerWelcomeHtml("Владимир");
  const plain = html.replace(/<[^>]+>/g, " ");
  assert.match(plain, /Владимир, привет!/);
  assert.match(plain, /Добро пожаловать в Trenio\.by/);
  assert.match(plain, /Размещение профиля бесплатное/);
  assert.match(plain, /актуальные направления, адреса тренировок, фотографии/);
  assert.match(plain, /Отзывы и заполненный профиль/);
  assert.match(plain, /этот диалог/);
  assert.match(plain, /подключить Telegram/);
  assert.match(plain, /Mini App/);
  assert.match(html, new RegExp(`href="${PORTAL_TELEGRAM_URL.replace(/[.]/g, "\\.")}"`));
  assert.doesNotMatch(plain, /популярност|YClients|верификац/);
  assert.ok(reviewTextLength(html) <= 1000);
});

test("a mailbox confirmation of a published page congratulates and keeps the welcome", () => {
  const html = trainerWelcomeHtml("Анна", undefined, true);
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(plain, /Анна, привет!/);
  const hello = plain.indexOf("Анна, привет!");
  const news = plain.indexOf("Поздравляем, ваш аккаунт подтверждён.");
  const rest = plain.indexOf("Добро пожаловать в Trenio.by");
  assert.ok(hello >= 0 && hello < news && news < rest);
  assert.match(plain, /Размещение профиля бесплатное/);
  assert.ok(reviewTextLength(html) <= 1000);
});
