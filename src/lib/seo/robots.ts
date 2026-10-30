import { SITE_ORIGIN } from "@/lib/seo/site";

/** Paths a crawler should not spend budget on. Public catalog URLs stay allowed. */
const PRIVATE_PREFIXES = [
  "/admin",
  "/account",
  "/me",
  "/auth",
  "/trainer-admin",
  "/trainers/claim",
  "/search",
] as const;

export function robotsTxt() {
  const disallow = PRIVATE_PREFIXES.map((path) => `Disallow: ${path}`).join("\n");
  return [
    "User-agent: *",
    "Allow: /",
    disallow,
    "",
    "User-agent: Yandex",
    "Allow: /",
    disallow,
    "Clean-param: sports&city&utm_source&utm_medium&utm_campaign&utm_content&utm_term&fbclid&gclid&yclid&ysclid",
    "Host: trenio.by",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}
