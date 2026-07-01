#!/usr/bin/env node
/**
 * Builds public/data/belarus-settlements.json from GeoNames BY export.
 * Source: https://download.geonames.org/export/dump/BY.zip (CC-BY 4.0)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const zipPath = path.join(root, ".cache/geonames-BY.zip");
const outPath = path.join(root, "public/data/belarus-settlements.json");
const CYRILLIC = /[\u0400-\u04FF]/;

function cyrillicLabels(name, alternatenames) {
  const labels = new Set();
  const push = (value) => {
    const trimmed = value.trim();
    if (trimmed && CYRILLIC.test(trimmed)) labels.add(trimmed);
  };
  push(name);
  for (const alt of alternatenames.split(",")) push(alt);
  return [...labels];
}

async function ensureZip() {
  await mkdir(path.dirname(zipPath), { recursive: true });
  try {
    await execFileAsync("curl", ["-sL", "-o", zipPath, "https://download.geonames.org/export/dump/BY.zip"]);
  } catch {
    await execFileAsync("wget", ["-q", "-O", zipPath, "https://download.geonames.org/export/dump/BY.zip"]);
  }
}

async function readByTxt() {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, "BY.txt"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function main() {
  console.log("Downloading GeoNames BY.zip…");
  await ensureZip();
  console.log("Parsing populated places (feature class P)…");
  const text = await readByTxt();
  const seen = new Set();
  const settlements = [];

  for (const line of text.split("\n")) {
    if (!line) continue;
    const cols = line.split("\t");
    if (cols[6] !== "P") continue;
    for (const label of cyrillicLabels(cols[1], cols[3] ?? "")) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      settlements.push(label);
    }
  }

  settlements.sort((a, b) => a.localeCompare(b, "ru"));

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        source: "GeoNames BY export",
        license: "CC-BY 4.0",
        updated: new Date().toISOString().slice(0, 10),
        count: settlements.length,
        settlements,
      },
      null,
      0,
    ),
  );

  console.log(`Wrote ${settlements.length} settlements → ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
