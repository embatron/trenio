import { createFileRoute, redirect } from "@tanstack/react-router";
import { canonicalCategoryPath } from "@/lib/catalog/slug-policy";

export const Route = createFileRoute("/category/$parentSlug/$childSlug")({
  beforeLoad: ({ params }) => {
    const canonical = canonicalCategoryPath(params.parentSlug, params.childSlug);
    if (canonical && !canonical.childSlug) {
      throw redirect({
        to: "/categories/$slug",
        params: { slug: canonical.parentSlug },
      });
    }

    throw redirect({
      to: "/categories/$parentSlug/$childSlug",
      params: {
        parentSlug: canonical?.parentSlug ?? params.parentSlug,
        childSlug: canonical?.childSlug ?? params.childSlug,
      },
    });
  },
});
