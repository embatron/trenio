import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { shrinkImage } from "@/lib/images/tinify";
import { IMAGE_VARIANTS } from "@/lib/images/variants";

const VARIANTS: Array<{ name: (typeof IMAGE_VARIANTS)[number]; width: number; height: number; fit: "cover" | "inside" }> = [
  { name: "s128", width: 128, height: 128, fit: "cover" },
  { name: "c320", width: 320, height: 400, fit: "cover" },
  { name: "c640", width: 640, height: 800, fit: "cover" },
  { name: "w960", width: 960, height: 1280, fit: "inside" },
];

async function writeDerivatives(source: ReturnType<typeof sharp>, absoluteMaster: string) {
  const base = absoluteMaster.replace(/\.[a-z0-9]+$/i, "");
  await Promise.all(VARIANTS.map(async (variant) => {
    const file = await source
      .clone()
      .resize({
        width: variant.width,
        height: variant.height,
        fit: variant.fit,
        position: "attention",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    await writeFile(`${base}-${variant.name}.jpg`, file);
  }));
}

/** Master plus fixed derivatives. Orientation is applied, metadata is dropped, nothing is upscaled. */
export async function writeImageSet(buffer: Buffer, absoluteMaster: string) {
  await mkdir(path.dirname(absoluteMaster), { recursive: true });
  const prepared = await sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const master = await shrinkImage(prepared);
  await writeFile(absoluteMaster, master);
  await writeDerivatives(sharp(master, { failOn: "none" }), absoluteMaster);
}

/** Derivatives beside an existing master. The master file stays as stored. */
export async function ensureImageDerivatives(absoluteMaster: string) {
  await writeDerivatives(sharp(absoluteMaster, { failOn: "none", animated: false }).rotate(), absoluteMaster);
}

export async function removeImageSet(absoluteMaster: string) {
  const base = absoluteMaster.replace(/\.[a-z0-9]+$/i, "");
  await Promise.all([
    absoluteMaster,
    ...IMAGE_VARIANTS.map((variant) => `${base}-${variant}.jpg`),
  ].map((file) => unlink(file).catch(() => undefined)));
}
