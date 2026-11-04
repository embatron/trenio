import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { trainerByPhrase } from "@/lib/catalog/sport-taxonomy";
import { seoHead } from "@/lib/seo/head";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN, siteTitle } from "@/lib/seo/site";
import { breadcrumbList } from "@/lib/seo/schema";
import { bynAmount, cityIn, clipMeta, plainText } from "@/lib/seo/text";

export type TrainerSeoSource = {
  slug: string;
  name: string;
  sports: string[];
  sportDatives: string[];
  primarySport: { slug: string; parentSlug: string; label: string };
  city: { slug: string; label: string };
  about: string[];
  rating: { value: string; reviewCount: number };
  photo: string;
  instagram: string;
  telegram?: string;
  places: Array<{ city: string; address: string; lat: number | null; lng: number | null }>;
  priceLines: string[];
  /** ISO timestamps from the profile row. Omitted on a fixture that has no clock. */
  createdAt?: string;
  updatedAt?: string;
  /** Public catalog page. A draft, a preview, and a staff look stay out of the index and emit no graph. */
  index?: boolean;
};

/** Document phrase, without the site name: «Тренер по боксу Артём Романович в Минске». */
export function trainerDocumentPhrase(
  datives: string[],
  city: { slug: string; label: string },
  name = "",
) {
  const place = city.label.trim() ? cityIn(city.slug, city.label) : "Беларуси";
  const person = name.trim();
  const sports = trainerByPhrase(datives);
  return person ? `${sports} ${person} в ${place}` : `${sports} в ${place}`;
}

function isoStamp(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function profileImage(photo: string) {
  const value = photo.trim();
  if (!value) return undefined;
  return absoluteUrl(value);
}

/** The title phrase already names the person. Then as much of the biography as fits. */
function trainerMetaDescription(phrase: string, detail: string) {
  const lead = `${phrase}.`;
  const extra = detail.replace(/\s+/g, " ").trim();
  if (!extra) return clipMeta(lead);
  const combined = `${lead} ${extra}`;
  if (combined.length <= 170) return combined;
  const room = 169 - lead.length - 1;
  if (room < 24) return clipMeta(lead);
  const slice = extra.slice(0, room);
  const sentence = slice.lastIndexOf(". ");
  const space = slice.lastIndexOf(" ");
  const cutAt = sentence >= 24 ? sentence + 1 : space > 24 ? space : slice.length;
  const cut = slice.slice(0, cutAt).replace(/[.,;: ]+$/g, "");
  return `${lead} ${cut}…`;
}

function sportPath(sport: TrainerSeoSource["primarySport"]) {
  if (!sport.slug) return "/categories";
  if (sport.parentSlug === sport.slug) return `/categories/${sport.slug}`;
  return `/categories/${sport.parentSlug}/${sport.slug}`;
}

function sameAs(trainer: TrainerSeoSource) {
  return [trainer.instagram, trainer.telegram]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.startsWith("https://") || value.startsWith("http://"));
}

export function trainerSeoHead(trainer: TrainerSeoSource) {
  const phrase = trainerDocumentPhrase(trainer.sportDatives, trainer.city, trainer.name);
  const place = trainer.city.label.trim()
    ? cityIn(trainer.city.slug, trainer.city.label)
    : "Беларуси";
  const path = `/trainers/${trainer.slug}`;
  const url = absoluteUrl(path);
  const about = trainer.about.map((item) => plainText(item)).find(Boolean) ?? "";
  const price = trainer.priceLines.map(bynAmount).find((amount) => amount != null) ?? null;
  const detail = about || (price != null ? `Одно занятие — ${price} BYN.` : "Цена, формат и контакты.");
  const description = trainerMetaDescription(phrase, detail);
  const image = profileImage(trainer.photo);
  const createdAt = isoStamp(trainer.createdAt);
  const updatedAt = isoStamp(trainer.updatedAt);
  const alternateName = trainer.slug.trim().toLowerCase() !== trainer.name.trim().toLowerCase()
    ? trainer.slug.trim()
    : "";
  const rating = Number(trainer.rating.value);
  const cityPage = cityCatalogBySlug(trainer.city.slug);
  const crumbs = [
    { name: "Главная", path: "/" },
    ...(cityPage
      ? [{ name: `Тренеры в ${place}`, path: `/city/${trainer.city.slug}` }]
      : [{ name: `Тренеры в ${place}`, path }]),
    { name: trainer.primarySport.label, path: sportPath(trainer.primarySport) },
    { name: trainer.name, path },
  ];
  const locations = trainer.places
    .filter((item) => item.address || item.city)
    .slice(0, 3)
    .map((item) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: item.address || undefined,
        addressLocality: item.city || trainer.city.label,
        addressCountry: "BY",
      },
      ...(item.lat != null && item.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: item.lat, longitude: item.lng } }
        : {}),
    }));

  const knowsAbout = trainer.sports.map((item) => item.trim()).filter(Boolean);

  return seoHead({
    title: siteTitle(phrase),
    description,
    path,
    type: "profile",
    image: image ?? null,
    imageAlt: image ? phrase : undefined,
    index: trainer.index !== false,
    jsonLd: [
      breadcrumbList(crumbs),
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url,
        name: phrase,
        description,
        inLanguage: "ru-BY",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
        ...(createdAt ? { dateCreated: createdAt } : {}),
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        ...(image ? { primaryImageOfPage: image } : {}),
        mainEntity: {
          "@type": "Person",
          "@id": `${url}#person`,
          name: trainer.name,
          ...(alternateName ? { alternateName } : {}),
          url,
          mainEntityOfPage: url,
          jobTitle: phrase,
          description,
          ...(image ? { image } : {}),
          ...(knowsAbout.length ? { knowsAbout } : {}),
          ...(trainer.city.label.trim()
            ? {
                address: {
                  "@type": "PostalAddress",
                  addressLocality: trainer.city.label,
                  addressCountry: "BY",
                },
                areaServed: { "@type": "City", name: trainer.city.label },
              }
            : {}),
          ...(locations.length ? { workLocation: locations } : {}),
          ...(sameAs(trainer).length ? { sameAs: sameAs(trainer) } : {}),
          ...(trainer.rating.reviewCount > 0 && rating > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: rating.toFixed(1),
                  reviewCount: trainer.rating.reviewCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              }
            : {}),
          ...(price != null
            ? {
                makesOffer: {
                  "@type": "Offer",
                  priceCurrency: "BYN",
                  price: String(price),
                  url,
                  description: "Одно персональное занятие",
                },
              }
            : {}),
        },
      },
    ],
  });
}
