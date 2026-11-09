import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_PREVIEW_CHARS,
  compactReviewHtml,
  pastedReviewHtml,
  reviewExcerpt,
  reviewTextLength,
  reviewVisibleText,
  sanitizeReviewHtml,
} from "@/lib/catalog/review-html";

test("compactReviewHtml drops blank paragraphs and repeated spaces", () => {
  const html = "<p>Мне 38.&nbsp;</p><p><br></p><p>Объясняет  понятно.&nbsp;</p><p><br><br></p>";
  assert.equal(compactReviewHtml(html), "<p>Мне 38.</p><p>Объясняет понятно.</p>");
  assert.equal(reviewVisibleText(html), "Мне 38. Объясняет понятно.");
});

test("compactReviewHtml keeps a short list and a single line break", () => {
  assert.equal(
    compactReviewHtml("<ul><li>Хороший тренер.&nbsp;</li></ul>"),
    "<ul><li>Хороший тренер.</li></ul>",
  );
  assert.equal(
    compactReviewHtml("<p>Первая строка.<br><br>Вторая.</p>"),
    "<p>Первая строка.<br>Вторая.</p>",
  );
});

test("sanitizeReviewHtml keeps editor marks and drops a pasted document", () => {
  const pasted = [
    "<!DOCTYPE html>",
    "<html><head><style>p{color:red}</style></head><body>",
    "<!--StartFragment-->",
    '<p class="MsoNormal">Я Фархад.<o:p></o:p></p>',
    "<p>Сейчас преподаю <b>кикбоксинг</b>.</p>",
    '<h2>Титулы</h2><span style="font-size:12px">мастер спорта</span>',
    '<script>alert(1)</script><a href="javascript:alert(1)">сайт</a>',
    '<a href="https://trenio.by/trainers/demo" onclick="alert(1)">карточка</a>',
    "</body></html>",
  ].join("");
  assert.equal(
    sanitizeReviewHtml(pasted),
    '<p>Я Фархад.</p><p>Сейчас преподаю <b>кикбоксинг</b>.</p><p>Титулы</p>мастер спортасайт<a href="https://trenio.by/trainers/demo" rel="nofollow noopener">карточка</a>',
  );
});

test("pastedReviewHtml prefers cleaned HTML and falls back to plain text", () => {
  assert.equal(
    pastedReviewHtml("<p>Одна строка.</p><div>Вторая</div>", "Одна строка.\nВторая"),
    "<p>Одна строка.</p><p>Вторая</p>",
  );
  assert.equal(
    pastedReviewHtml("<script>alert(1)</script>", "Обычный текст\nвторая"),
    "Обычный текст<br>вторая",
  );
  assert.equal(pastedReviewHtml("", "3 < 4 & 5"), "3 &lt; 4 &amp; 5");
});

test("reviewExcerpt keeps a short review and cuts a long one on a word", () => {
  const short = "<p>Очень хороший тренер, всем советую.</p>";
  assert.equal(reviewExcerpt(short), reviewVisibleText(short));
  assert.equal(reviewTextLength(reviewVisibleText(short)) <= REVIEW_PREVIEW_CHARS, true);

  const word = "слово";
  const long = `<p>${Array.from({ length: 80 }, () => word).join(" ")}</p>`;
  const excerpt = reviewExcerpt(long);
  assert.equal(excerpt.endsWith("…"), true);
  assert.equal(excerpt.endsWith("слово…"), true);
  assert.equal(reviewTextLength(excerpt) <= REVIEW_PREVIEW_CHARS + 1, true);
  assert.equal(reviewTextLength(reviewVisibleText(long)) > REVIEW_PREVIEW_CHARS, true);
});
