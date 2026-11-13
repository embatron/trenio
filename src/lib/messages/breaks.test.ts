import assert from "node:assert/strict";
import test from "node:test";

import {
  MESSAGE_BREAK_CAP,
  clipPlainMessage,
  collapseMessageHtml,
  collapsePlainBreaks,
  messageBreaksNeedTighten,
} from "@/lib/messages/breaks";
import { reviewPlainText } from "@/lib/catalog/review-html";

test("a million line breaks collapse to one blank line", () => {
  const bomb = `\n`.repeat(1_000_000);
  const plain = collapsePlainBreaks(bomb);
  assert.equal(plain, "\n\n");
  const html = collapseMessageHtml(`<p>Привет</p>${"<br>".repeat(1_000_000)}<p>ещё</p>`);
  assert.equal(html, "<p>Привет</p><br><br><p>ещё</p>");
  assert.equal(reviewPlainText(html).includes("Привет"), true);
  assert.equal((html.match(/<br>/g) ?? []).length <= MESSAGE_BREAK_CAP, true);
});

test("breaks between words stop at the cap", () => {
  const html = collapseMessageHtml(Array.from({ length: 1_000 }, () => "а<br>").join(""));
  assert.equal((html.match(/<br>/g) ?? []).length, MESSAGE_BREAK_CAP);
  assert.equal(messageBreaksNeedTighten(`<br>`.repeat(MESSAGE_BREAK_CAP + 1)), true);
  assert.equal(messageBreaksNeedTighten("<p>Одна строка</p>"), false);
});

test("a pasted novel is cut on the grapheme limit after breaks collapse", () => {
  const text = clipPlainMessage(`${"строка\n\n\n".repeat(100)}конец`, 12);
  assert.equal([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length <= 12, true);
  assert.equal(text.includes("\n\n\n"), false);
});
