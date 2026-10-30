import assert from "node:assert/strict";
import test from "node:test";

import { isCompressibleImage, shouldTinifyStoredFile, tinifyImage } from "@/lib/images/tinify";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);

test("photo magic is jpeg, png, webp, and avif", () => {
  assert.equal(isCompressibleImage(JPEG), true);
  assert.equal(isCompressibleImage(PNG), true);
  const webp = Buffer.alloc(12);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(isCompressibleImage(webp), true);
  const avif = Buffer.alloc(12);
  avif.set([0x66, 0x74, 0x79, 0x70], 4);
  avif.write("avif", 8, "ascii");
  assert.equal(isCompressibleImage(avif), true);
  assert.equal(isCompressibleImage(GIF), false);
  assert.equal(isCompressibleImage(Buffer.from("not-an-image!!")), false);
});

test("stored trainer files stay out of the backlog", () => {
  assert.equal(shouldTinifyStoredFile("public/trainers/instagram/coach.jpg"), false);
  assert.equal(shouldTinifyStoredFile("public/trainers/self/user.jpg"), false);
  assert.equal(shouldTinifyStoredFile("public/trainers/admin/slug/photos/a.jpg"), false);
  assert.equal(shouldTinifyStoredFile("trainers/instagram/coach.jpg"), false);
  assert.equal(shouldTinifyStoredFile("public/images/categories/yoga.webp"), true);
  assert.equal(shouldTinifyStoredFile("public/avatars/user.jpg"), true);
  assert.equal(shouldTinifyStoredFile("data/message-files/a/b.preview.jpg"), true);
  assert.equal(shouldTinifyStoredFile("public/favicon.ico"), false);
  assert.equal(shouldTinifyStoredFile("public/images/../trainers/a.jpg"), false);
});

test("a missing key does not call TinyPNG", async () => {
  const previous = process.env.TINIFY_API_KEY;
  delete process.env.TINIFY_API_KEY;
  try {
    const output = await tinifyImage(JPEG);
    assert.equal(output, JPEG);
  } finally {
    if (previous === undefined) delete process.env.TINIFY_API_KEY;
    else process.env.TINIFY_API_KEY = previous;
  }
});
