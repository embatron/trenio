import { stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import {
  certificateExt,
  certificateKind,
  certificatePreviewPaths,
  trainerMediaPath,
  type TrainerDocument,
} from "@/lib/catalog/certificate-preview";
import { logCaught } from "@/lib/log/logger";

const require = createRequire(import.meta.url);

const inflight = new Map<string, Promise<{ thumb: string; view: string }>>();

function absolutePublic(urlPath: string) {
  return path.join(process.cwd(), "public", urlPath.slice(1));
}

async function fresh(urlPath: string, sourceMtime: number) {
  try {
    const file = await stat(absolutePublic(urlPath));
    return file.isFile() && file.size > 0 && file.mtimeMs >= sourceMtime;
  } catch {
    return false;
  }
}

const IMAGE_UPLOAD = new Set(["jpg", "png", "webp", "gif"]);

/** A scan or photo is stored as a viewing JPEG. A PDF and other documents stay as uploaded. */
export async function prepareCertificateUpload(buffer: Buffer, ext: string) {
  if (!IMAGE_UPLOAD.has(ext)) return { ext, bytes: buffer };
  const pair = await jpegPair(buffer);
  return { ext: "jpg", bytes: pair.view };
}

async function jpegPair(source: Buffer) {
  const view = await sharp(source, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: 1400, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 74, mozjpeg: true })
    .toBuffer();
  const thumb = await sharp(view, { failOn: "none" })
    .resize({ width: 280, height: 360, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer();
  return { thumb, view };
}

async function pdfPage(bytes: Buffer) {
  const [{ getDocument, GlobalWorkerOptions }, { createCanvas }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  // The production bundle sits in dist/ and looks for pdf.worker.mjs beside itself.
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height) || 1;
    const viewport = page.getViewport({ scale: Math.min(1600 / longest, 2) });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return canvas.toBuffer("image/jpeg", 82);
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

async function buildPreviews(clean: string, kind: "image" | "pdf") {
  const absolute = absolutePublic(clean);
  const source = await stat(absolute);
  const names = certificatePreviewPaths(clean);
  if ((await fresh(names.thumb, source.mtimeMs)) && (await fresh(names.view, source.mtimeMs))) {
    return names;
  }
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(absolute);
  const pair = await jpegPair(kind === "pdf" ? await pdfPage(bytes) : bytes);
  await Promise.all([
    writeFile(absolutePublic(names.thumb), pair.thumb),
    writeFile(absolutePublic(names.view), pair.view),
  ]);
  return names;
}

async function previewOf(clean: string, kind: "image" | "pdf") {
  const running = inflight.get(clean);
  if (running) return running;
  const job = buildPreviews(clean, kind).finally(() => inflight.delete(clean));
  inflight.set(clean, job);
  return job;
}

/** Writes the thumbnail and the viewing JPEG next to a file that is already on disk. */
export async function storeCertificatePreviews(publicPath: string) {
  const clean = trainerMediaPath(publicPath);
  const kind = certificateKind(publicPath);
  if (!clean || (kind !== "image" && kind !== "pdf")) return null;
  return previewOf(clean, kind);
}

export async function presentCertificates(items: TrainerCertificate[]): Promise<TrainerDocument[]> {
  return Promise.all(items.map(async (item) => {
    const clean = trainerMediaPath(item.path);
    const kind = certificateKind(item.path);
    const ext = (certificateExt(item.path) || "file").toUpperCase();
    const document: TrainerDocument = {
      path: item.path.split("?")[0],
      caption: item.caption,
      kind,
      ext,
      thumb: "",
      view: "",
    };
    if (!clean || kind === "file") return document;
    try {
      const preview = await previewOf(clean, kind);
      return { ...document, thumb: preview.thumb, view: preview.view };
    } catch (error) {
      logCaught("catalog", "catalog.certificate.preview", error, { target: clean });
      return document;
    }
  }));
}
