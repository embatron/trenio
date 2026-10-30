import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { shrinkImage } from "@/lib/images/tinify";

const ROOT = path.join(process.cwd(), "data", "message-files");

function safeId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function messageFilePath(conversationId: string, id: string, ext: string) {
  if (!safeId(conversationId) || !safeId(id) || !/^[a-z0-9]{2,5}$/.test(ext)) {
    throw new Error("bad attachment path");
  }
  const root = path.resolve(ROOT);
  const file = path.resolve(root, conversationId, `${id}.${ext}`);
  if (file !== root && !file.startsWith(root + path.sep)) throw new Error("bad attachment path");
  return file;
}

export async function writeMessageFile(
  conversationId: string,
  id: string,
  ext: string,
  bytes: Uint8Array,
) {
  const file = messageFilePath(conversationId, id, ext);
  await mkdir(path.dirname(file), { recursive: true });
  const payload = await shrinkImage(Buffer.from(bytes));
  await writeFile(file, payload);
  return payload.length;
}

export function messagePreviewPath(conversationId: string, id: string) {
  if (!safeId(conversationId) || !safeId(id)) throw new Error("bad attachment path");
  const root = path.resolve(ROOT);
  const file = path.resolve(root, conversationId, `${id}.preview.jpg`);
  if (!file.startsWith(root + path.sep)) throw new Error("bad attachment path");
  return file;
}

/** A small JPEG for the chat. The original file stays beside it. */
export async function writeMessagePreview(conversationId: string, id: string, bytes: Uint8Array) {
  const prepared = await sharp(Buffer.from(bytes), { failOn: "none", animated: false })
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  const preview = await shrinkImage(prepared);
  const file = messagePreviewPath(conversationId, id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, preview);
}

export async function readMessagePreview(conversationId: string, id: string) {
  return readFile(messagePreviewPath(conversationId, id));
}

export async function readMessageFile(conversationId: string, id: string, ext: string) {
  return readFile(messageFilePath(conversationId, id, ext));
}

export async function removeMessageFile(conversationId: string, id: string, ext: string) {
  await unlink(messageFilePath(conversationId, id, ext)).catch(() => undefined);
  await unlink(messagePreviewPath(conversationId, id)).catch(() => undefined);
}
