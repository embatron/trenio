import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getSportTaxonomyChild,
  getTopLevelSportCategory,
} from "@/lib/catalog/sport-taxonomy";

export const Route = createFileRoute("/category/$slug")({
  beforeLoad: ({ params }) => {
    const child = getSportTaxonomyChild(params.slug);
    if (child && !getTopLevelSportCategory(params.slug)) {
      throw redirect({
        to: "/categories/$parentSlug/$childSlug",
        params: { parentSlug: child.parentSlug, childSlug: child.slug },
      });
    }

    throw redirect({
      to: "/categories/$slug",
      params: { slug: params.slug },
    });
  },
});
