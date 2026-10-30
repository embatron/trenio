/**
 * Compress images already on disk. Skips public/trainers.
 * Usage: npm run images:tinify
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  shouldTinifyStoredFile,
  tinifyCompressionCount,
  tinifyErrorKind,
  tinifyImage,
  tinifyKey,
} from "@/lib/images/tinify";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "tinify-manifest.json");
const ROOTS = [path.join(ROOT, "public"), path.join(ROOT, "data", "message-files")];

type Manifest = { files: Record<string, string> };

function hash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function relative(file: string) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

async function loadManifest(): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Manifest;
    if (parsed && typeof parsed.files === "object" && parsed.files) return parsed;
  } catch {
    // First run.
  }
  return { files: {} };
}

async function saveManifest(manifest: Manifest) {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  const ordered = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(MANIFEST_PATH, `${JSON.stringify({ files: ordered }, null, 2)}\n`);
}

async function collect(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "trainers" && path.resolve(dir) === path.resolve(ROOT, "public")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (entry.isFile() && !entry.name.endsWith(".tinify-tmp")) files.push(full);
  }
  return files;
}

async function sameShape(before: Buffer, after: Buffer) {
  const [left, right] = await Promise.all([
    sharp(before, { failOn: "none", animated: false }).metadata(),
    sharp(after, { failOn: "none", animated: false }).metadata(),
  ]);
  return left.format === right.format && left.width === right.width && left.height === right.height;
}

async function main() {
  if (!tinifyKey()) {
    console.error("TINIFY_API_KEY is empty. Nothing was compressed.");
    process.exitCode = 1;
    return;
  }

  const manifest = await loadManifest();
  const files = (await Promise.all(ROOTS.map((dir) => collect(dir))))
    .flat()
    .filter((file) => shouldTinifyStoredFile(relative(file)))
    .sort();

  let compressed = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  for (const file of files) {
    const rel = relative(file);
    const input = await readFile(file);
    const before = hash(input);
    if (manifest.files[rel] === before) {
      skipped += 1;
      continue;
    }
    const remember = async (digest: string) => {
      manifest.files[rel] = digest;
      await saveManifest(manifest);
    };

    let output: Buffer;
    try {
      output = await tinifyImage(input);
    } catch (error) {
      const kind = tinifyErrorKind(error);
      const message = error instanceof Error ? error.message : "TinyPNG failed";
      if (kind === "account") {
        console.error(`Stopped at ${rel}: ${message}`);
        failed += 1;
        break;
      }
      console.error(`${rel}: ${message}`);
      failed += 1;
      if (kind === "client") await remember(before);
      continue;
    }

    if (output === input || output.length >= input.length) {
      await remember(before);
      skipped += 1;
      continue;
    }
    if (!(await sameShape(input, output))) {
      console.error(`${rel}: TinyPNG changed the dimensions or format. Kept the original.`);
      await remember(before);
      failed += 1;
      continue;
    }

    const temp = `${file}.tinify-tmp`;
    await writeFile(temp, output);
    try {
      const written = await stat(temp);
      if (written.size !== output.length) throw new Error("short write");
      await rename(temp, file);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    await remember(hash(output));
    compressed += 1;
    savedBytes += input.length - output.length;
    const count = tinifyCompressionCount();
    console.log(
      `${rel}  ${input.length} -> ${output.length}${count == null ? "" : `  (${count} this month)`}`,
    );
  }

  console.log(
    `Compressed ${compressed}, skipped ${skipped}, failed ${failed}. Saved ${savedBytes} bytes.`,
  );
  if (failed > 0) process.exitCode = 1;
}

await main();
