import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import {
  getParentCategoryFeaturedImage,
  getTopLevelSportCategory,
  isPublishedSportCategory,
} from "@/lib/catalog/sport-taxonomy";
import {
  pickFacePhoto,
  renderContainCard,
  renderShareCard,
  sharePhotoRelative,
  type FaceCandidate,
} from "@/lib/images/share-card";
import { logCaught } from "@/lib/log/logger";
import { trainerSitemapPath } from "@/lib/seo/sitemap";

function photoFile(urlPath: string) {
  const relative = sharePhotoRelative(urlPath);
  if (!relative) return null;
  const roots = [path.resolve("public"), path.resolve("dist/client")];
  for (const root of roots) {
    const file = path.resolve(root, relative);
    if (file !== root && file.startsWith(root + path.sep) && existsSync(file)) return file;
  }
  return null;
}

async function measuredPhoto(urlPath: string): Promise<FaceCandidate | null> {
  const file = photoFile(urlPath);
  if (!file) return null;
  const meta = await sharp(file, { failOn: "none", animated: false }).metadata();
  return { path: urlPath, width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Every trainer page uses one face card. The file is chosen from that trainer's photos. */
export async function trainerShareJpeg(slug: string) {
  if (typeof slug !== "string" || !trainerSitemapPath(slug)) return null;
  try {
    const [row] = await getDb()
      .select({
        photos: trainerProfiles.photos,
        avatarPath: trainerProfiles.avatarPath,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, slug))
      .limit(1);
    const listed = [...(row?.photos ?? []), row?.avatarPath ?? ""]
      .map((item) => item.trim())
      .filter(Boolean);
    const unique = [...new Set(listed)];
    const measured = (await Promise.all(unique.map((item) => measuredPhoto(item)))).filter(
      (item): item is FaceCandidate => Boolean(item),
    );
    const picked = pickFacePhoto(measured, slug);
    const file = picked ? photoFile(picked.path) : null;
    if (!file) return null;
    return await renderShareCard(await readFile(file));
  } catch (error) {
    logCaught("catalog", "catalog.share", error, {
      target: slug,
      route: `/og/trainers/${slug}.jpg`,
    });
    return null;
  }
}

function categoryArtFile(urlPath: string) {
  const value = urlPath.trim().split("?")[0] ?? "";
  if (!value.startsWith("/images/") || value.includes("..") || value.includes("\\")) return null;
  if (!/\.(png|jpe?g|webp)$/i.test(value)) return null;
  const relative = value.slice(1);
  const roots = [path.resolve("public"), path.resolve("dist/client")];
  for (const root of roots) {
    const file = path.resolve(root, relative);
    if (file !== root && file.startsWith(root + path.sep) && existsSync(file)) return file;
  }
  return null;
}

/** The category illustration, fitted whole into the same 1200×630 card. */
export async function categoryShareJpeg(slug: string) {
  if (typeof slug !== "string") return null;
  const category = getTopLevelSportCategory(slug);
  if (!category || !isPublishedSportCategory(category)) return null;
  const art = getParentCategoryFeaturedImage(slug);
  const file = art ? categoryArtFile(art) : null;
  if (!file) return null;
  try {
    return await renderContainCard(await readFile(file));
  } catch (error) {
    logCaught("catalog", "catalog.share", error, {
      target: slug,
      route: `/og/categories/${slug}.jpg`,
    });
    return null;
  }
}
