import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";

/**
 * Instagram accounts that are closed for good.
 * Import, sync, and every Instagram letter refuse the handle.
 */
const SILENT_INSTAGRAM_HANDLES = new Set(["latysheu"]);

export function isSilentInstagram(value: string): boolean {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? trimmed.replace(/^@/, "");
  const handle = instagramProfileSlug(fromUrl);
  return handle.length > 0 && SILENT_INSTAGRAM_HANDLES.has(handle);
}
