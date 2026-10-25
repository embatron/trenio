import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import {
  catalogPageHead,
  catalogSportLocation,
  catalogSportsFromQuery,
} from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { CategoryCatalogPage } from "@/routes/categories.$slug";

export const Route = createFileRoute("/city/$slug/")({
  validateSearch: (search: Record<string, unknown>) => ({
    sports: typeof search.sports === "string" ? search.sports : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    const city = cityCatalogBySlug(params.slug);
    if (!city) throw notFound();
    const sports = catalogSportsFromQuery(search.sports);
    if (sports.length === 1) throw redirect(catalogSportLocation(city.slug, sports[0]));
  },
  head: ({ params, match }) => {
    const city = cityCatalogBySlug(params.slug);
    if (!city) return { meta: [{ title: "Город | trenio.by" }] };
    const sports = catalogSportsFromQuery(match.search.sports);
    return catalogPageHead(city, null, sports.length > 1);
  },
  loader: async () => {
    const [ratings, prices] = await Promise.all([listTrainerRatingSummariesFn(), listTrainerPricesFn()]);
    return { ratings, prices };
  },
  component: CityCatalogRoute,
});

function CityCatalogRoute() {
  const { slug } = Route.useParams();
  const { sports: sportsQuery } = Route.useSearch();
  const { ratings, prices } = Route.useLoaderData();
  const city = cityCatalogBySlug(slug);
  if (!city) return null;
  const sportSelection = catalogSportsFromQuery(sportsQuery);

  return (
    <CategoryCatalogPage
      key={`${slug}:${sportSelection.map((sport) => sport.id).join("|")}`}
      ratings={ratings}
      prices={prices}
      cityCatalog={city}
      sportSelection={sportSelection}
      place={{ cities: [city.name], query: "", source: "none", lookupOnClient: false }}
    />
  );
}
