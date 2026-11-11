import assert from "node:assert/strict";
import test from "node:test";

import { markerEndingAt, messageMarkup } from "@/lib/messages/markup";

test("message markers become inline styles and drop a script", () => {
  assert.equal(messageMarkup("**жирный** и _курсив_ и __черта__"), "<strong>жирный</strong> и <em>курсив</em> и <u>черта</u>");
  assert.equal(messageMarkup("`код` и ~~нет~~ и ||тайна||"), '<code>код</code> и <s>нет</s> и <span class="tg-spoiler">тайна</span>');
  assert.equal(messageMarkup("**_вместе_**"), "<strong><em>вместе</em></strong>");
  assert.equal(messageMarkup("\\**не**"), "**не**");
  const attacked = messageMarkup("**<script>alert(1)</script>**");
  assert.equal(attacked.includes("<script"), false);
  assert.equal(attacked.includes("alert"), false);
  assert.equal(
    messageMarkup("[карточка](https://trenio.by/trainers/demo)"),
    '<a href="https://trenio.by/trainers/demo" rel="nofollow noopener">карточка</a>',
  );
  assert.equal(messageMarkup("[нет](javascript:alert(1))"), "[нет](javascript:alert(1))");
});

test("the longest closed marker wins when the caret sits at the end", () => {
  const text = "**жирный**";
  const token = markerEndingAt(text, text.length);
  assert.equal(token?.kind, "bold");
  assert.equal(token && text.slice(token.contentStart, token.contentEnd), "жирный");
  assert.equal(markerEndingAt("**жирный*", "**жирный*".length), null);
});

test("a fenced block stays literal and a line break in the editor is kept", () => {
  assert.equal(messageMarkup("```**нет**```"), "<pre>**нет**</pre>");
  assert.equal(messageMarkup("<div>**да**</div>"), "<p><strong>да</strong></p>");
});
