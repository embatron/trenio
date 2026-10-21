/** Derived files sit next to the master: `photo.jpg` → `photo-c320.jpg`. */
export const IMAGE_VARIANTS = ["s128", "c320", "c640", "w960"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

const VARIANT_RE = /-(?:s128|c320|c640|w960)(?=\.[a-z0-9]+$)/i;

export function masterImagePath(src: string) {
  const [path, query = ""] = src.split("?");
  return { path: path.replace(VARIANT_RE, ""), query };
}

export function variantImagePath(src: string, variant: ImageVariant) {
  const { path, query } = masterImagePath(src);
  if (!/\.(jpe?g|png|webp)$/i.test(path)) return src;
  const next = path.replace(/\.[a-z0-9]+$/i, `-${variant}.jpg`);
  return query ? `${next}?${query}` : next;
}
