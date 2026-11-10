import {
  DEFAULT_SHARE_IMAGE,
  OG_LOCALE,
  SITE_NAME,
  absoluteUrl,
  documentLead,
} from "@/lib/seo/site";
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
  /** Alt for a page photo. The wordmark card keeps its own alt. */
  imageAlt?: string;
  /** Pixel size of `image`. Declared so a root 1200×630 does not stay attached to another file. */
  imageWidth?: number;
  imageHeight?: number;
  /** MIME of `image` when the size is known, for example `image/jpeg`. */
  imageType?: string;
  /** Messenger title. The document title stays `title`, which still carries the site name. */
  shareTitle?: string;
  /** Messenger description. The search description stays `description`. */
  shareDescription?: string;
  type?: "website" | "profile" | "article";
  jsonLd?: Array<JsonLd | null | undefined>;
};

export function seoHead(input: SeoHeadInput) {
  const title = input.title.trim();
  const description = clipMeta(input.description);
  const shareTitle = (input.shareTitle ?? documentLead(title)).trim();
  const shareDescription = clipMeta(input.shareDescription ?? description);
  const canonical = absoluteUrl(input.path);
  const image = absoluteUrl(input.image || DEFAULT_SHARE_IMAGE);
  const sized =
    input.imageWidth && input.imageHeight
      ? [
          { property: "og:image:width" as const, content: String(input.imageWidth) },
          { property: "og:image:height" as const, content: String(input.imageHeight) },
          ...(input.imageType
            ? [{ property: "og:image:type" as const, content: input.imageType }]
            : []),
        ]
      : [];
  const index = input.index !== false;
  const follow = input.follow !== false;
  const jsonLd = (input.jsonLd ?? []).filter((node): node is JsonLd => Boolean(node));
  // An indexable document without a graph is a bug. A noindex document emits no graph.
  if (index && jsonLd.length === 0) {
    throw new Error(
      "Indexable head has no JSON-LD. Call the page-kind helper in src/lib/seo/pages.ts.",
    );
  }

  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "robots",
        content: `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}`,
      },
      { property: "og:title", content: shareTitle },
      { property: "og:description", content: shareDescription },
      { property: "og:type", content: input.type ?? "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      ...(input.image
        ? [
            ...sized,
            ...(input.imageAlt
              ? [{ property: "og:image:alt" as const, content: input.imageAlt }]
              : []),
          ]
        : [
            { property: "og:image:width" as const, content: "1200" },
            { property: "og:image:height" as const, content: "630" },
            { property: "og:image:alt" as const, content: SITE_NAME },
          ]),
      { property: "og:locale", content: OG_LOCALE },
      // No og:site_name. Telegram prints that tag above og:title, so the site
      // name would lead every share. The document title still ends with SITE_NAME.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: shareTitle },
      { name: "twitter:description", content: shareDescription },
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
