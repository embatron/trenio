import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  pickFacePhoto,
  renderContainCard,
  renderShareCard,
  sharePhotoRelative,
} from "@/lib/images/share-card";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/images/share-size";

test("the share path stays inside public trainer and avatar photos", () => {
  assert.equal(
    sharePhotoRelative("/trainers/instagram/sergey.the.champ.jpg"),
    "trainers/instagram/sergey.the.champ.jpg",
  );
  assert.equal(sharePhotoRelative("/trainers/self/user.jpg?v=1"), "trainers/self/user.jpg");
  assert.equal(sharePhotoRelative("https://trenio.by/avatars/a.png"), "avatars/a.png");
  assert.equal(sharePhotoRelative("/trainers/../.env"), null);
  assert.equal(sharePhotoRelative("/og.png"), null);
  assert.equal(sharePhotoRelative("data/secret.jpg"), null);
});

test("the face file wins a square tie, and a wide graphic loses to a portrait", () => {
  const slug = "sergey.the.champ";
  const face = { path: "/trainers/instagram/sergey.the.champ.jpg", width: 1080, height: 1080 };
  const gallery = {
    path: "/trainers/instagram/sergey.the.champ-g2.jpg",
    width: 1080,
    height: 1080,
  };
  const wide = { path: "/trainers/instagram/sergey.the.champ.jpg", width: 1600, height: 500 };
  const portrait = {
    path: "/trainers/instagram/sergey.the.champ-g2.jpg",
    width: 900,
    height: 1200,
  };
  const thumb = { path: "/trainers/instagram/sergey.the.champ-c320.jpg", width: 320, height: 400 };
  assert.equal(pickFacePhoto([gallery, face, thumb], slug)?.path, face.path);
  assert.equal(pickFacePhoto([wide, portrait], slug)?.path, portrait.path);
  assert.equal(pickFacePhoto([thumb], slug)?.path, thumb.path);
  assert.equal(pickFacePhoto([], slug), null);
});

test("a share card is a baseline 1200×630 jpeg and keeps the top of the portrait", async () => {
  const width = 400;
  const height = 400;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const top = y < 40;
      pixels[index] = top ? 220 : 10;
      pixels[index + 1] = 10;
      pixels[index + 2] = top ? 10 : 220;
    }
  }
  const source = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
  const card = await renderShareCard(source);
  const meta = await sharp(card).metadata();
  assert.equal(meta.width, SHARE_CARD_WIDTH);
  assert.equal(meta.height, SHARE_CARD_HEIGHT);
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.isProgressive, false);
  assert.ok(card.length < 300_000);
  const sample = await sharp(card)
    .extract({ left: 8, top: 8, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(sample[0] > sample[2]);
});

test("a category card keeps the whole picture inside a baseline 1200×630 jpeg", async () => {
  const source = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 220, g: 20, b: 20 } },
  })
    .png()
    .toBuffer();
  const card = await renderContainCard(source);
  const meta = await sharp(card).metadata();
  assert.equal(meta.width, SHARE_CARD_WIDTH);
  assert.equal(meta.height, SHARE_CARD_HEIGHT);
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.isProgressive, false);
  const corner = await sharp(card)
    .extract({ left: 4, top: 4, width: 1, height: 1 })
    .raw()
    .toBuffer();
  const center = await sharp(card)
    .extract({ left: 600, top: 315, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(corner[0] < 20 && corner[1] < 20 && corner[2] < 20);
  assert.ok(center[0] > center[2]);
});
