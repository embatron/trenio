import { CATALOG_ORIGIN } from "@/lib/catalog/catalog-sports";

/** Public origin. Canonical, Open Graph, sitemap, and JSON-LD use this host. */
export const SITE_ORIGIN = CATALOG_ORIGIN;

/** Name of the site in titles, Open Graph, and schema.org. The domain stays trenio.by. */
export const SITE_NAME = "Я ищу тренера на trenio.by";

export function siteTitle(lead: string) {
  return `${lead.trim()} | ${SITE_NAME}`;
}

/** The phrase before the site name. A leftover `| trenio.by` suffix is stripped too. */
export function documentLead(title: string) {
  const value = title.trim();
  const suffix = ` | ${SITE_NAME}`;
  const bare = value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  return bare.replace(/\s*\|\s*trenio\.by\s*$/i, "").trim();
}

/** Document language. The catalog is Russian for Belarus, not a Belarusian mirror. */
export const SITE_LOCALE = "ru-BY";

export const OG_LOCALE = "ru_BY";

/** Public mailbox. Footer, contacts, privacy, and schema.org use this address. */
export const SITE_EMAIL = "trenioby@gmail.com";

/** Public Instagram of the catalog. Footer and the mega menu use this address. */
export const SITE_INSTAGRAM_URL = "https://www.instagram.com/trenioby/";

/** Square mark for the organization logo in structured data. */
export const SITE_LOGO = "/logo-mark.png";

/** 1200×630 card: the white wordmark on the footer background. */
export const DEFAULT_SHARE_IMAGE = "/og.png";

export function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("http://")) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}
