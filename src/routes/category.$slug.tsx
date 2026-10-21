import { createFileRoute, redirect } from "@tanstack/react-router";
import { canonicalCategoryPath } from "@/lib/catalog/slug-policy";
import {
  getSportTaxonomyChild,
  getTopLevelSportCategory,
} from "@/lib/catalog/sport-taxonomy";

export const Route = createFileRoute("/category/$slug")({
  beforeLoad: ({ params }) => {
    const canonical = canonicalCategoryPath(params.slug);
    if (canonical?.childSlug) {
      throw redirect({
        to: "/categories/$parentSlug/$childSlug",
        params: { parentSlug: canonical.parentSlug, childSlug: canonical.childSlug },
      });
    }
    if (canonical) {
      throw redirect({
        to: "/categories/$slug",
        params: { slug: canonical.parentSlug },
      });
    }

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
