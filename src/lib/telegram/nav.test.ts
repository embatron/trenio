import assert from "node:assert/strict";
import test from "node:test";

import {
  TELEGRAM_NAV,
  activeTelegramNavPath,
  resolveTelegramAction,
  telegramMainKeyboard,
  telegramPublicOrigin,
} from "./nav";

test("bot keyboard lists every section as a Mini App button", () => {
  const rows = telegramMainKeyboard("https://trenio.by");
  const labels = rows.flat().map((button) => button.text);
  assert.deepEqual(labels, TELEGRAM_NAV.map((item) => item.label));
  assert.equal(rows.length, 4);
  for (const row of rows) {
    for (const button of row) {
      assert.equal("web_app" in button, true);
      if ("web_app" in button) assert.match(button.web_app.url, /^https:\/\/trenio\.by\//);
    }
  }
});

test("local origin still points Mini App buttons at the public site", () => {
  assert.equal(telegramPublicOrigin("http://trenio.local"), "https://trenio.by");
  const home = telegramMainKeyboard("http://trenio.local");
  const first = home[0]?.[0];
  assert.ok(first && "web_app" in first);
  if (first && "web_app" in first) assert.equal(first.web_app.url, "https://trenio.by/");
});

test("commands and button labels open the same section", () => {
  assert.equal(resolveTelegramAction("/start"), "home");
  assert.equal(resolveTelegramAction("/start@TrenioByBot"), "home");
  assert.equal(resolveTelegramAction("/messages"), "messages");
  assert.equal(resolveTelegramAction("Кабинет тренера"), "me");
  assert.equal(resolveTelegramAction("привет"), null);
});

test("the open tab is the longest matching path", () => {
  assert.equal(activeTelegramNavPath("/"), "/");
  assert.equal(activeTelegramNavPath("/categories/fitnes"), "/categories/");
  assert.equal(activeTelegramNavPath("/account/messages"), "/account/messages");
  assert.equal(activeTelegramNavPath("/account/favorites"), "/account");
  assert.equal(activeTelegramNavPath("/me/profile"), "/me");
});
