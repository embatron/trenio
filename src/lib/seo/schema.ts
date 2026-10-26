import { absoluteUrl, OG_LOCALE, SITE_EMAIL, SITE_LOGO, SITE_NAME, SITE_ORIGIN } from "@/lib/seo/site";

export type SeoCrumb = { name: string; path: string };

export type SeoLink = { name: string; path: string };

const CONTEXT = "https://schema.org";

export function breadcrumbList(crumbs: SeoCrumb[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function faqPage(items: Array<{ q: string; a: string }>) {
  const mainEntity = items
    .map((item) => ({
      "@type": "Question",
      name: item.q.trim(),
      acceptedAnswer: { "@type": "Answer", text: item.a.trim() },
    }))
    .filter((item) => item.name && item.acceptedAnswer.text);
  if (!mainEntity.length) return null;
  return { "@context": CONTEXT, "@type": "FAQPage", mainEntity };
}

export function collectionPage(input: { name: string; path: string; description: string; items?: SeoLink[] }) {
  return {
    "@context": CONTEXT,
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: OG_LOCALE.replace("_", "-"),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
    ...(input.items?.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: input.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.path),
            })),
          },
        }
      : {}),
  };
}

export function homeGraph(faq: Array<{ q: string; a: string }>) {
  return [
    {
      "@context": CONTEXT,
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_ORIGIN,
      logo: absoluteUrl(SITE_LOGO),
      email: SITE_EMAIL,
      areaServed: { "@type": "Country", name: "Беларусь" },
      description: "Каталог тренеров в Беларуси. Сервис не проверяет квалификацию и не принимает оплату за занятия.",
    },
    {
      "@context": CONTEXT,
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_ORIGIN,
      inLanguage: "ru-BY",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_ORIGIN}/search?sport={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    faqPage(faq),
  ];
}

export function aboutPage(input: { name: string; path: string; description: string }) {
  return {
    "@context": CONTEXT,
    "@type": "AboutPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "ru-BY",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
  };
}

export function contactPage(input: { name: string; path: string; description: string }) {
  return {
    "@context": CONTEXT,
    "@type": "ContactPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "ru-BY",
    mainEntity: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_ORIGIN,
      email: SITE_EMAIL,
    },
  };
}

export function webPage(input: { name: string; path: string; description: string }) {
  return {
    "@context": CONTEXT,
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "ru-BY",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
  };
}
