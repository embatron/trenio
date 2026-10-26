import { createFileRoute, notFound, Outlet, redirect } from "@tanstack/react-router";
import { catalogSportById } from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { canonicalCategoryPath } from "@/lib/catalog/slug-policy";

export const Route = createFileRoute("/city/$slug/$sport")({
  beforeLoad: ({ params }) => {
    const city = cityCatalogBySlug(params.slug);
    if (!city) throw notFound();
    const sport = catalogSportById(params.sport);
    if (sport && sport.id === params.sport) return;
    const legacy = canonicalCategoryPath(params.sport);
    const next = legacy ? catalogSportById(legacy.childSlug ?? legacy.parentSlug) : null;
    if (next) {
      throw redirect({
        to: next.id.includes("/") ? "/city/$slug/$sport/$child" : "/city/$slug/$sport",
        params: next.id.includes("/")
          ? { slug: city.slug, sport: next.parentSlug, child: next.slug }
          : { slug: city.slug, sport: next.id },
      });
    }
    throw notFound();
  },
  component: CitySportLayout,
});

function CitySportLayout() {
  return <Outlet />;
}
