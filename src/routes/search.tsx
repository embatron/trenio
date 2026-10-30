import { createFileRoute } from "@tanstack/react-router";

import { CatalogMapScreen } from "@/routes/map";
import { resolveVisitorPointFn } from "@/lib/catalog/visitor-place";
import { searchPageHead } from "@/lib/seo/pages";

type SearchParams = {
  sport: string;
  location: string;
  audience: "adult" | "child";
  format?: "individual" | "group";
};

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    sport: typeof s.sport === "string" ? s.sport : "",
    location: typeof s.location === "string" ? s.location : "",
    audience: s.audience === "child" ? "child" : "adult",
    format: s.format === "group" || s.format === "individual" ? s.format : undefined,
  }),
  head: ({ match }) => {
    const search = match.search;
    const q = [search.sport, search.location].filter(Boolean).join(" · ");
    return searchPageHead(q);
  },
  loader: async () => ({ point: await resolveVisitorPointFn() }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const { point } = Route.useLoaderData();
  return (
    <CatalogMapScreen
      mode="search"
      sportText={search.sport}
      locationText={search.location}
      audience={search.audience}
      format={search.format}
      visitor={point}
    />
  );
}
