import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { trainerByPhrase } from "@/lib/catalog/sport-taxonomy";
import { seoHead } from "@/lib/seo/head";
import { absoluteUrl } from "@/lib/seo/site";
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
};

function sportPath(sport: TrainerSeoSource["primarySport"]) {
  if (sport.parentSlug === sport.slug) return `/categories/${sport.slug}`;
  return `/categories/${sport.parentSlug}/${sport.slug}`;
}

function sameAs(trainer: TrainerSeoSource) {
  return [trainer.instagram, trainer.telegram]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.startsWith("https://") || value.startsWith("http://"));
}

export function trainerSeoHead(trainer: TrainerSeoSource) {
  const place = cityIn(trainer.city.slug, trainer.city.label);
  const phrase = trainerByPhrase(trainer.sportDatives);
  const path = `/trainers/${trainer.slug}`;
  const url = absoluteUrl(path);
  const about = plainText(trainer.about[0] ?? "");
  const price = trainer.priceLines.map(bynAmount).find((amount) => amount != null) ?? null;
  const description = clipMeta(
    about
      ? `${trainer.name}, ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)} в ${place}. ${about}`
      : `${trainer.name} — ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)} в ${place}. Цена, формат и контакты.`,
  );
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

  return seoHead({
    title: `${phrase} | trenio.by`,
    description,
    path,
    type: "profile",
    image: trainer.photo || null,
    jsonLd: [
      breadcrumbList(crumbs),
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url,
        inLanguage: "ru-BY",
        mainEntity: {
          "@type": "Person",
          name: trainer.name,
          url,
          jobTitle: phrase,
          image: trainer.photo ? absoluteUrl(trainer.photo) : undefined,
          knowsAbout: trainer.sports,
          address: {
            "@type": "PostalAddress",
            addressLocality: trainer.city.label,
            addressCountry: "BY",
          },
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
