import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { certificateExt, certificateKind, certificatePreviewPaths, trainerMediaPath } from "./certificate-preview";

test("a certificate path keeps its kind and the preview names", () => {
  assert.equal(certificateKind("/trainers/admin/coach/certificates/card.JPEG"), "image");
  assert.equal(certificateExt("/trainers/admin/coach/certificates/card.JPEG"), "jpg");
  assert.equal(certificateKind("/trainers/admin/coach/certificates/card.pdf"), "pdf");
  assert.equal(certificateKind("/trainers/admin/coach/certificates/card.docx"), "file");
  assert.deepEqual(certificatePreviewPaths("/trainers/admin/coach/certificates/card.pdf?v=1"), {
    thumb: "/trainers/admin/coach/certificates/card-doc-thumb.jpg",
    view: "/trainers/admin/coach/certificates/card-doc-view.jpg",
  });
  assert.equal(trainerMediaPath("/trainers/admin/coach/certificates/card.pdf"), "/trainers/admin/coach/certificates/card.pdf");
  assert.equal(trainerMediaPath("/trainers/../.env"), null);
  assert.equal(trainerMediaPath("/uploads/card.pdf"), null);
});

test("a large scan is stored as a viewing jpeg", async () => {
  const { prepareCertificateUpload } = await import("./certificate-preview.server");
  const png = await sharp({
    create: { width: 2400, height: 3200, channels: 3, background: { r: 240, g: 240, b: 236 } },
  }).png().toBuffer();
  assert.ok(png.length > 10_000);
  const prepared = await prepareCertificateUpload(png, "png");
  assert.equal(prepared.ext, "jpg");
  assert.ok(prepared.bytes.length < png.length);
  const meta = await sharp(prepared.bytes).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok((meta.width ?? 0) <= 1400);
  assert.ok((meta.height ?? 0) <= 1800);
  const pdf = await prepareCertificateUpload(Buffer.from("%PDF-1.4"), "pdf");
  assert.equal(pdf.ext, "pdf");
  assert.equal(pdf.bytes.toString(), "%PDF-1.4");
});

test("an image certificate becomes a small jpeg pair", async () => {
  const { presentCertificates } = await import("./certificate-preview.server");
  const dir = await mkdtemp(path.join(process.cwd(), "public", "trainers", "preview-test-"));
  const source = path.join(dir, "card.png");
  try {
    const png = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 20, g: 90, b: 80 } },
    }).png().toBuffer();
    await writeFile(source, png);
    const url = `/${path.relative(path.join(process.cwd(), "public"), source).split(path.sep).join("/")}`;
    const [document] = await presentCertificates([{ path: url, caption: "Диплом" }]);
    assert.equal(document.kind, "image");
    assert.equal(document.caption, "Диплом");
    assert.match(document.thumb, /-doc-thumb\.jpg$/);
    const thumb = await readFile(path.join(process.cwd(), "public", document.thumb.slice(1)));
    const view = await readFile(path.join(process.cwd(), "public", document.view.slice(1)));
    assert.ok(thumb.length > 0);
    assert.ok(view.length > 0);
    const meta = await sharp(thumb).metadata();
    assert.equal(meta.format, "jpeg");
    assert.ok((meta.width ?? 0) <= 280);
    assert.ok((meta.height ?? 0) <= 360);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
