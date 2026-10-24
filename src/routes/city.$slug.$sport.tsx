import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { catalogSportById } from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";

export const Route = createFileRoute("/city/$slug/$sport")({
  beforeLoad: ({ params }) => {
    const city = cityCatalogBySlug(params.slug);
    const sport = catalogSportById(params.sport);
    if (!city || !sport || sport.id !== params.sport) throw notFound();
  },
  component: CitySportLayout,
});

function CitySportLayout() {
  return <Outlet />;
}
