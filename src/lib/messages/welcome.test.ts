import assert from "node:assert/strict";
import test from "node:test";

import { reviewTextLength } from "@/lib/catalog/review-html";
import { PORTAL_TELEGRAM_URL, trainerWelcomeHtml } from "./welcome";

test("the trainer welcome is warm, short, and from Trenioby", () => {
  const html = trainerWelcomeHtml("Владимир");
  const plain = html.replace(/<[^>]+>/g, " ");
  assert.match(plain, /Владимир, привет!/);
  assert.match(plain, /Trenioby/);
  assert.match(plain, /рады/);
  assert.match(plain, /популярност/);
  assert.match(plain, /отзыв/);
  assert.match(plain, /не берём, никакой оплаты за карточку нет/);
  assert.match(plain, /YClients/);
  assert.match(plain, /этот диалог/);
  assert.match(plain, /miniApp/);
  assert.match(html, new RegExp(`href="${PORTAL_TELEGRAM_URL.replace(/[.]/g, "\\.")}"`));
  assert.doesNotMatch(plain, /Это я/);
  assert.ok(reviewTextLength(html) <= 1000);
});
