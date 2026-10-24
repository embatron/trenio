import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";

export const Route = createFileRoute("/city/$slug")({
  beforeLoad: ({ params }) => {
    if (!cityCatalogBySlug(params.slug)) throw notFound();
  },
  component: CityLayout,
});

function CityLayout() {
  return <Outlet />;
}
