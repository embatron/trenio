import { createFileRoute } from "@tanstack/react-router";
import { catalogSportById } from "@/lib/catalog/catalog-sports";
import { catalogPageHead } from "@/lib/seo/catalog";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { CategoryCatalogPage } from "@/routes/categories.$slug";

export const Route = createFileRoute("/city/$slug/$sport/")({
  head: ({ params }) => {
    const city = cityCatalogBySlug(params.slug);
    const sport = catalogSportById(params.sport);
    if (!city || !sport) return { meta: [{ title: "Город | trenio.by" }] };
    return catalogPageHead(city, sport);
  },
  loader: async () => {
    const [ratings, prices] = await Promise.all([listTrainerRatingSummariesFn(), listTrainerPricesFn()]);
    return { ratings, prices };
  },
  component: CitySportRoute,
});

function CitySportRoute() {
  const { slug, sport: sportSlug } = Route.useParams();
  const { ratings, prices } = Route.useLoaderData();
  const city = cityCatalogBySlug(slug);
  const sport = catalogSportById(sportSlug);
  if (!city || !sport) return null;

  return (
    <CategoryCatalogPage
      key={`${slug}:${sport.id}`}
      ratings={ratings}
      prices={prices}
      cityCatalog={city}
      pageSport={sport}
      place={{ cities: [city.name], query: "", source: "none", lookupOnClient: false }}
    />
  );
}
