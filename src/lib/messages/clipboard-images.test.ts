import assert from "node:assert/strict";
import test from "node:test";

import { clipboardFiles, clipboardSuggestsImage, filesFromHtmlImages } from "@/lib/messages/clipboard-images";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("a screenshot file is taken from items when the file list is empty", () => {
  const file = new File([Uint8Array.from([1, 2, 3, 4])], "image.png", { type: "image/png" });
  const found = clipboardFiles({
    files: [],
    items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0]?.name, "image.png");
});

test("the same screenshot is not attached twice", () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const listed = new File([bytes], "image.png", { type: "image/png" });
  const again = new File([bytes], "image.png", { type: "image/png" });
  const found = clipboardFiles({
    files: [listed],
    items: [{ kind: "file", type: "image/png", getAsFile: () => again }],
  });
  assert.equal(found.length, 1);
});

test("an image that arrives only as HTML becomes a file", () => {
  const html = `<meta charset="utf-8"><img src="${PNG}" alt="">`;
  const files = filesFromHtmlImages(html);
  assert.equal(files.length, 1);
  assert.equal(files[0]?.type, "image/png");
  assert.equal(files[0]?.name, "screenshot.png");
  assert.ok((files[0]?.size ?? 0) > 0);
});

test("a file paste is treated as a possible picture", () => {
  assert.equal(clipboardSuggestsImage(["Files"]), true);
  assert.equal(clipboardSuggestsImage(["text/plain"]), false);
});
