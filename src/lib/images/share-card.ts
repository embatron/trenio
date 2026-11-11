import sharp from "sharp";

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/images/share-size";

const PHOTO_TOP = new Set(["trainers", "avatars"]);

/** A public trainer or account photo, as a path under `public/`. */
export function sharePhotoRelative(urlPath: string) {
  let value = urlPath.trim().split("?")[0] ?? "";
  if (value.startsWith("https://trenio.by/")) value = value.slice("https://trenio.by".length);
  if (
    !value.startsWith("/") ||
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("\0")
  )
    return null;
  const relative = value.slice(1);
  const top = relative.split("/")[0] ?? "";
  if (!PHOTO_TOP.has(top) || !/\.(jpe?g|png|webp)$/i.test(relative)) return null;
  return relative;
}

const DERIVATIVE = /-(?:s128|c320|c640|w960)(?=\.[a-z0-9]+$)/i;
const TARGET = SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT;

export type FaceCandidate = { path: string; width: number; height: number };

export function isImageDerivative(urlPath: string) {
  const relative = sharePhotoRelative(urlPath) ?? urlPath.split("?")[0] ?? "";
  return DERIVATIVE.test(relative);
}

/** The face file wins when it is a portrait. A wide graphic loses to a later square frame. */
export function pickFacePhoto(candidates: FaceCandidate[], slug: string) {
  const usable = candidates.filter((item) => item.width > 0 && item.height > 0 && item.path.trim());
  const masters = usable.filter((item) => !isImageDerivative(item.path));
  const pool = masters.length > 0 ? masters : usable;
  if (pool.length === 0) return null;
  return pool
    .slice()
    .sort((a, b) => faceScore(b, slug) - faceScore(a, slug) || a.path.localeCompare(b.path))[0];
}

function faceScore(item: FaceCandidate, slug: string) {
  const minSide = Math.min(item.width, item.height);
  const aspect = item.width / item.height;
  let score = Math.min(minSide, 1600) / 40;
  if (minSide < 400) score -= 80;
  if (aspect >= 0.65 && aspect <= 1.45) score += 50;
  else if (aspect >= 1.8) score -= 40;
  else score += 8;
  const name =
    item.path
      .split("?")[0]
      ?.split("/")
      .pop()
      ?.replace(/\.[a-z0-9]+$/i, "") ?? "";
  if (name === slug) score += 70;
  return score;
}

type Crop = { left: number; top: number; width: number; height: number };

function isSkin(red: number, green: number, blue: number) {
  return red > 90 && green > 35 && blue > 15 && red > green && red > blue && red - green > 12;
}

/** A 1200:630 window on the face. A frame with no skin keeps the top of the portrait. */
export function subjectCrop(
  width: number,
  height: number,
  rgb: Uint8Array,
  cols: number,
  rows: number,
): Crop {
  if (width < 2 || height < 2 || rgb.length < cols * rows * 3) return coverTop(width, height);
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;
  let skin = 0;
  for (let y = 0; y < rows; y += 1) {
    if ((y + 0.5) / rows > 0.82) continue;
    for (let x = 0; x < cols; x += 1) {
      const index = (y * cols + x) * 3;
      if (!isSkin(rgb[index] ?? 0, rgb[index + 1] ?? 0, rgb[index + 2] ?? 0)) continue;
      skin += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (skin < cols * rows * 0.04 || maxX < minX || maxY < minY) return coverTop(width, height);

  const cellW = width / cols;
  const cellH = height / rows;
  const left = Math.max(0, minX * cellW - cellW);
  const top = Math.max(0, minY * cellH - cellH);
  const boxW = Math.min(width - left, (maxX - minX + 3) * cellW);
  const boxH = Math.min(height - top, (maxY - minY + 3) * cellH);
  let winW = boxW;
  let winH = boxH;
  if (winW / winH < TARGET) winW = winH * TARGET;
  else winH = winW / TARGET;
  const minW = Math.min(width, Math.max(winW, width / 1.8));
  if (winW < minW) {
    winW = minW;
    winH = winW / TARGET;
  }
  if (winW > width) {
    winW = width;
    winH = winW / TARGET;
  }
  if (winH > height) {
    winH = height;
    winW = Math.min(width, winH * TARGET);
    winH = winW / TARGET;
  }
  const boxRight = Math.min(width, left + boxW);
  const boxBottom = Math.min(height, top + boxH);
  let winLeft = left + boxW / 2 - winW / 2;
  let winTop = top - winH * 0.06;
  winLeft = Math.min(Math.max(0, winLeft), Math.max(0, width - winW));
  winTop = Math.min(Math.max(0, winTop), Math.max(0, height - winH));
  if (winLeft > left) winLeft = Math.max(0, left);
  if (winLeft + winW < boxRight) winLeft = Math.max(0, boxRight - winW);
  if (winTop > top) winTop = Math.max(0, top);
  if (winTop + winH < boxBottom) winTop = Math.max(0, boxBottom - winH);
  winLeft = Math.min(Math.max(0, winLeft), Math.max(0, width - winW));
  winTop = Math.min(Math.max(0, winTop), Math.max(0, height - winH));
  return fitCrop(width, height, winLeft, winTop, winW, winH);
}

function coverTop(width: number, height: number): Crop {
  let winW = width;
  let winH = winW / TARGET;
  if (winH > height) {
    winH = height;
    winW = winH * TARGET;
  }
  return fitCrop(width, height, (width - winW) / 2, 0, winW, winH);
}

function fitCrop(
  width: number,
  height: number,
  left: number,
  top: number,
  winW: number,
  winH: number,
): Crop {
  const cropW = Math.max(1, Math.min(width, Math.round(winW)));
  const cropH = Math.max(1, Math.min(height, Math.round(winH)));
  const cropLeft = Math.max(0, Math.min(width - cropW, Math.round(left)));
  const cropTop = Math.max(0, Math.min(height - cropH, Math.round(top)));
  return { left: cropLeft, top: cropTop, width: cropW, height: cropH };
}

async function frameSample(bytes: Buffer) {
  const oriented = sharp(bytes, { failOn: "none", animated: false }).rotate();
  const meta = await oriented.clone().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const cols = 32;
  const rows = 32;
  const rgb = await oriented
    .clone()
    .resize(cols, rows, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  return { width, height, rgb, cols, rows, oriented };
}

function baselineCard(input: ReturnType<typeof sharp>) {
  return input
    .resize({
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      fit: "cover",
      position: "north",
    })
    .jpeg({ quality: 80, progressive: false, mozjpeg: false })
    .toBuffer();
}

/** 1200×630 baseline JPEG. The whole picture stays inside the frame, on black. */
export async function renderContainCard(bytes: Buffer) {
  return sharp(bytes, { failOn: "none", animated: false })
    .rotate()
    .flatten({ background: "#000000" })
    .resize({
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      fit: "contain",
      background: "#000000",
    })
    .jpeg({ quality: 80, progressive: false, mozjpeg: false })
    .toBuffer();
}

/** 1200×630 baseline JPEG. A portrait keeps the head. A wide frame follows the skin. */
export async function renderShareCard(bytes: Buffer) {
  const frame = await frameSample(bytes);
  const aspect = frame.height > 0 ? frame.width / frame.height : 1;
  if (frame.width < 2 || frame.height < 2 || aspect <= 1.45) {
    return baselineCard(sharp(bytes, { failOn: "none", animated: false }).rotate());
  }
  const crop = subjectCrop(frame.width, frame.height, frame.rgb, frame.cols, frame.rows);
  return frame.oriented
    .clone()
    .extract(crop)
    .resize({ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, fit: "fill" })
    .jpeg({ quality: 80, progressive: false, mozjpeg: false })
    .toBuffer();
}
