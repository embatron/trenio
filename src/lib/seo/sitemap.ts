import { CATALOG_ORIGIN } from "@/lib/catalog/catalog-sports";
import { absoluteUrl } from "@/lib/seo/site";

const INFO_PATHS = ["/about", "/contacts", "/offer", "/privacy", "/join/trainer"];

/** Instagram handle or a short name slug. One path segment, at most 30 characters. */
const TRAINER_SLUG = /^[A-Za-z0-9._-]{1,30}$/;

export type SitemapTrainer = {
  path: string;
  lastmod?: string;
  image?: string;
  imageTitle?: string;
};

export function trainerSitemapPath(slug: string) {
  const clean = slug.trim();
  if (!TRAINER_SLUG.test(clean) || clean.includes("..") || clean.startsWith(".") || clean.endsWith(".")) return null;
  return `/trainers/${clean}`;
}

/** A photo the crawler can fetch. A filesystem path and an empty avatar stay out. */
export function publicAssetUrl(path: string) {
  const value = path.trim().split("?")[0] ?? "";
  if (!value || value.includes("..")) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  if (value.startsWith("/")) return absoluteUrl(value);
  return null;
}

export function sitemapDay(date: Date) {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlNode(path: string, extra?: Pick<SitemapTrainer, "lastmod" | "image" | "imageTitle">) {
  const lines = ["  <url>", `    <loc>${xmlEscape(`${CATALOG_ORIGIN}${path}`)}</loc>`];
  if (extra?.lastmod) lines.push(`    <lastmod>${xmlEscape(extra.lastmod)}</lastmod>`);
  if (extra?.image) {
    lines.push("    <image:image>", `      <image:loc>${xmlEscape(extra.image)}</image:loc>`);
    if (extra.imageTitle) lines.push(`      <image:title>${xmlEscape(extra.imageTitle)}</image:title>`);
    lines.push("    </image:image>");
  }
  lines.push("  </url>");
  return lines.join("\n");
}

/** Catalog and info URLs, then published trainer profiles. Drafts are not in `trainers`. */
export function renderSitemapXml(catalogPaths: string[], trainers: SitemapTrainer[]) {
  const body = [
    ...catalogPaths.map((path) => urlNode(path)),
    ...INFO_PATHS.map((path) => urlNode(path)),
    ...trainers.map((trainer) => urlNode(trainer.path, trainer)),
  ];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    ...body,
    `</urlset>`,
  ].join("\n");
}
