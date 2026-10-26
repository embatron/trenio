import { DEFAULT_SHARE_IMAGE, OG_LOCALE, SITE_NAME, absoluteUrl } from "@/lib/seo/site";
import { clipMeta } from "@/lib/seo/text";

export const NOINDEX_FOLLOW = { name: "robots" as const, content: "noindex, follow" };
export const NOINDEX_NOFOLLOW = { name: "robots" as const, content: "noindex, nofollow" };

type JsonLd = Record<string, unknown>;

export type SeoHeadInput = {
  title: string;
  description: string;
  /** Path on trenio.by, or an absolute URL. Query strings stay out of this value. */
  path: string;
  index?: boolean;
  follow?: boolean;
  /** Site-relative or absolute image. Omit to use the 1200×630 wordmark card. */
  image?: string | null;
  type?: "website" | "profile" | "article";
  jsonLd?: Array<JsonLd | null | undefined>;
};

export function seoHead(input: SeoHeadInput) {
  const title = input.title.trim();
  const description = clipMeta(input.description);
  const canonical = absoluteUrl(input.path);
  const image = absoluteUrl(input.image || DEFAULT_SHARE_IMAGE);
  const index = input.index !== false;
  const follow = input.follow !== false;
  const jsonLd = (input.jsonLd ?? []).filter((node): node is JsonLd => Boolean(node));
  // An indexable document without a graph is a bug. A noindex document emits no graph.
  if (index && jsonLd.length === 0) {
    throw new Error("Indexable head has no JSON-LD. Call the page-kind helper in src/lib/seo/pages.ts.");
  }

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}` },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: input.type ?? "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      ...(input.image
        ? []
        : [
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: SITE_NAME },
          ]),
      { property: "og:locale", content: OG_LOCALE },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: canonical }],
    scripts: index
      ? jsonLd.map((node) => ({
          type: "application/ld+json",
          children: JSON.stringify(node).replace(/</g, "\\u003c"),
        }))
      : [],
  };
}
