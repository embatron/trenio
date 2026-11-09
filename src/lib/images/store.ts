import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { shrinkImage } from "@/lib/images/tinify";
import { coverPosition, IMAGE_VARIANTS } from "@/lib/images/variants";

const VARIANTS: Array<{
  name: (typeof IMAGE_VARIANTS)[number];
  width: number;
  height: number;
  fit: "cover" | "inside";
}> = [
  { name: "s128", width: 128, height: 128, fit: "cover" },
  { name: "c320", width: 320, height: 400, fit: "cover" },
  { name: "c640", width: 640, height: 800, fit: "cover" },
  { name: "w960", width: 960, height: 1280, fit: "inside" },
];

async function writeDerivatives(
  source: ReturnType<typeof sharp>,
  absoluteMaster: string,
  position: "attention" | "centre",
) {
  const meta = await source.clone().metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  const base = absoluteMaster.replace(/\.[a-z0-9]+$/i, "");
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const gravity =
        position === "centre" || variant.fit !== "cover"
          ? "centre"
          : coverPosition(sourceWidth, sourceHeight, variant.width, variant.height);
      const file = await source
        .clone()
        .resize({
          width: variant.width,
          height: variant.height,
          fit: variant.fit,
          position: gravity,
          withoutEnlargement: true,
        })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();
      await writeFile(`${base}-${variant.name}.jpg`, file);
    }),
  );
}

async function writePrepared(
  prepared: Buffer,
  absoluteMaster: string,
  position: "attention" | "centre",
) {
  await writeFile(absoluteMaster, prepared);
  await writeDerivatives(sharp(prepared, { failOn: "none" }), absoluteMaster, position);
}

/** Master plus fixed derivatives. Orientation is applied, metadata is dropped, nothing is upscaled. */
export async function writeImageSet(
  buffer: Buffer,
  absoluteMaster: string,
  position: "attention" | "centre" = "attention",
  compress: "now" | "later" = "now",
) {
  const directory = path.dirname(absoluteMaster);
  await mkdir(directory, { recursive: true });
  await chmod(directory, 0o755);
  const prepared = await sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  if (compress === "later") {
    await writePrepared(prepared, absoluteMaster, position);
    void shrinkImage(prepared)
      .then(async (master) => {
        if (master.equals(prepared)) return;
        await writePrepared(master, absoluteMaster, position);
      })
      .catch(() => undefined);
    return;
  }
  const master = await shrinkImage(prepared);
  await writePrepared(master, absoluteMaster, position);
}

/** Derivatives beside an existing master. The master file stays as stored. */
export async function ensureImageDerivatives(absoluteMaster: string) {
  await writeDerivatives(
    sharp(absoluteMaster, { failOn: "none", animated: false }).rotate(),
    absoluteMaster,
    "attention",
  );
}

export async function removeImageSet(absoluteMaster: string) {
  const base = absoluteMaster.replace(/\.[a-z0-9]+$/i, "");
  await Promise.all(
    [absoluteMaster, ...IMAGE_VARIANTS.map((variant) => `${base}-${variant}.jpg`)].map((file) =>
      unlink(file).catch(() => undefined),
    ),
  );
}
