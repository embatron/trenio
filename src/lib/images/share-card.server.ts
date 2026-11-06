import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import {
  pickFacePhoto,
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
  if (!trainerSitemapPath(slug)) return null;
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
