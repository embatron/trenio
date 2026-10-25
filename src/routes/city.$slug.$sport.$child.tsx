import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { catalogPageHead, catalogSportById } from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { CategoryCatalogPage } from "@/routes/categories.$slug";

export const Route = createFileRoute("/city/$slug/$sport/$child")({
  beforeLoad: ({ params }) => {
    const city = cityCatalogBySlug(params.slug);
    const sport = catalogSportById(`${params.sport}/${params.child}`);
    if (!city || !sport || sport.parentSlug !== params.sport) throw notFound();
    if (!sport.id.includes("/")) {
      throw redirect({
        to: "/city/$slug/$sport",
        params: { slug: city.slug, sport: sport.slug },
      });
    }
  },
  head: ({ params }) => {
    const city = cityCatalogBySlug(params.slug);
    const sport = catalogSportById(`${params.sport}/${params.child}`);
    if (!city || !sport) return { meta: [{ title: "Город | trenio.by" }] };
    return catalogPageHead(city, sport);
  },
  loader: async () => {
    const [ratings, prices] = await Promise.all([listTrainerRatingSummariesFn(), listTrainerPricesFn()]);
    return { ratings, prices };
  },
  component: CityNestedSportRoute,
});

function CityNestedSportRoute() {
  const { slug, sport: parentSlug, child } = Route.useParams();
  const { ratings, prices } = Route.useLoaderData();
  const city = cityCatalogBySlug(slug);
  const sport = catalogSportById(`${parentSlug}/${child}`);
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
