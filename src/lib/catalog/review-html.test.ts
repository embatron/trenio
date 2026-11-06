import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_PREVIEW_CHARS,
  compactReviewHtml,
  reviewExcerpt,
  reviewTextLength,
  reviewVisibleText,
} from "@/lib/catalog/review-html";

test("compactReviewHtml drops blank paragraphs and repeated spaces", () => {
  const html = "<p>Мне 38.&nbsp;</p><p><br></p><p>Объясняет  понятно.&nbsp;</p><p><br><br></p>";
  assert.equal(compactReviewHtml(html), "<p>Мне 38.</p><p>Объясняет понятно.</p>");
  assert.equal(reviewVisibleText(html), "Мне 38. Объясняет понятно.");
});

test("compactReviewHtml keeps a short list and a single line break", () => {
  assert.equal(compactReviewHtml("<ul><li>Хороший тренер.&nbsp;</li></ul>"), "<ul><li>Хороший тренер.</li></ul>");
  assert.equal(compactReviewHtml("<p>Первая строка.<br><br>Вторая.</p>"), "<p>Первая строка.<br>Вторая.</p>");
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
