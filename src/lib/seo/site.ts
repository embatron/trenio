import { CATALOG_ORIGIN } from "@/lib/catalog/catalog-sports";

/** Public origin. Canonical, Open Graph, sitemap, and JSON-LD use this host. */
export const SITE_ORIGIN = CATALOG_ORIGIN;

export const SITE_NAME = "trenio.by";

/** Document language. The catalog is Russian for Belarus, not a Belarusian mirror. */
export const SITE_LOCALE = "ru-BY";

export const OG_LOCALE = "ru_BY";

export const SITE_EMAIL = "hello@trenio.by";

/** Square mark for the organization logo in structured data. */
export const SITE_LOGO = "/logo-mark.png";

/** 1200×630 card: the white wordmark on the footer background. */
export const DEFAULT_SHARE_IMAGE = "/og.png";

export function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("http://")) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}
