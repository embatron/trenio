/**
 * Checks one saved Instagram draft before it is copied to the server.
 * Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/check-import.ts <handle>
 *
 * The face file must have the greatest shorter side. The street is geocoded
 * with the site geocoder. A venue name in that reply must not stay in the address.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { searchNominatim } from "../../../../src/lib/geo/nominatim.ts";

const handle = (process.argv[2] || "").replace(/\.json$/, "").trim().toLowerCase();
if (!handle) {
  console.error("Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/check-import.ts <handle>");
  process.exit(1);
}

const root = resolve(process.cwd());
const draftPath = join(root, "data/instagram-trainers", `${handle}.json`);
const photoDir = join(root, "public/trainers/instagram");

function fail(message: string): never {
  console.error(`${handle}: ${message}`);
  process.exit(1);
}

function fold(value: string) {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

async function sides(file: string) {
  const meta = await sharp(file, { failOn: "none" }).metadata();
  return { w: meta.width ?? 0, h: meta.height ?? 0, short: Math.min(meta.width ?? 0, meta.height ?? 0) };
}

if (!existsSync(draftPath)) fail(`No draft at ${draftPath}.`);
const draft = JSON.parse(readFileSync(draftPath, "utf8")) as {
  address?: string;
  city?: string;
  bio?: string;
  avatarPath?: string;
};

const faceName = `${handle}.jpg`;
const facePath = join(photoDir, faceName);
if (!existsSync(facePath)) fail("The face file is missing.");
const face = await sides(facePath);
const gallery = readdirSync(photoDir)
  .filter((name) => new RegExp(`^${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-g\\d+\\.jpg$`).test(name))
  .sort();
const gallerySides = [];
for (const name of gallery) {
  const size = await sides(join(photoDir, name));
  gallerySides.push({ name, ...size });
  if (size.short > face.short) {
    fail(`${name} is ${size.w}×${size.h}. The face is ${face.w}×${face.h}. The sharper photo must be the face.`);
  }
}

const address = (draft.address || "").trim();
const city = (draft.city || "").trim();
let geocode = "empty";
if (address) {
  const query = [address, city, "Беларусь"].filter(Boolean).join(", ");
  const found = await searchNominatim(query, { limit: 1, countrycodes: "by", belarusOnly: true });
  if (found.kind === "unavailable") {
    console.error(`${handle}: The site geocoder did not answer for «${query}». Do not report a map point.`);
    process.exit(2);
  }
  if (found.kind !== "ok") {
    geocode = `not_found query=${query}`;
  } else {
    const hit = found.hits[0];
    const venue = hit.displayName.split(",")[0]?.trim() || "";
    const venueFold = fold(venue);
    const streetFold = fold(hit.street);
    const venueIsStreet = Boolean(venueFold) && streetFold.includes(venueFold);
    if (venue && !venueIsStreet && fold(address).includes(venueFold)) {
      fail(`Address «${address}» includes the venue «${venue}». Keep the street. Name the venue in the presentation, the public «Обо мне».`);
    }
    geocode = `ok ${hit.lat},${hit.lng} query=${query} display=${hit.displayName} street=${hit.street}${venue && !venueIsStreet ? ` venue=${venue}` : ""}`;
  }
}

const galleryText = gallerySides.map((item) => `${item.name}:${item.w}x${item.h}`).join(",") || "none";
console.log(`${handle}\tface:${face.w}x${face.h}\tgallery:${galleryText}\tgeocode:${geocode}\taddress:${address || "—"}\tbio:${(draft.bio || "").trim() ? "yes" : "no"}`);
