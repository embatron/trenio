import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { canonicalCategoryPath } from "@/lib/catalog/slug-policy";
import { categorySearchDescription, getTopLevelSportCategory, getSportTaxonomyChildInCategory, isPublishedSportCategory } from "@/lib/catalog/sport-taxonomy";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { resolveVisitorPlaceFn } from "@/lib/catalog/visitor-place";
import {
  CategoryCatalogPage,
  categoryHeroLead,
  categoryKeyword,
  categoryPageTitle,
  resolveChildCategory,
} from "@/routes/categories.$slug";

export const Route = createFileRoute("/categories/$parentSlug/$childSlug")({
  beforeLoad: ({ params }) => {
    const canonical = canonicalCategoryPath(params.parentSlug, params.childSlug);
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

    const parent = getTopLevelSportCategory(params.parentSlug);
    if (parent && !isPublishedSportCategory(parent)) throw notFound();

    const category = resolveChildCategory(params.parentSlug, params.childSlug);
    if (!category) {
      throw redirect({
        to: "/categories/$slug",
        params: { slug: params.parentSlug },
      });
    }
  },
  head: ({ params }) => {
    const category = resolveChildCategory(params.parentSlug, params.childSlug);
    if (!category) {
      return { meta: [{ title: "Категория | trenio.by" }] };
    }

    const keyword = categoryKeyword(category, params.parentSlug);
    const title = categoryPageTitle(keyword);
    const aliases = getSportTaxonomyChildInCategory(params.parentSlug, params.childSlug)?.aliases;
    const desc = categorySearchDescription(
      title.replace(" | trenio.by", ""),
      categoryHeroLead(keyword, [], aliases),
      aliases,
    );
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  loader: async () => {
    const [ratings, prices, place] = await Promise.all([
      listTrainerRatingSummariesFn(),
      listTrainerPricesFn(),
      resolveVisitorPlaceFn(),
    ]);
    return { ratings, prices, place };
  },
  component: ChildCategoryPage,
});

function ChildCategoryPage() {
  const { parentSlug, childSlug } = Route.useParams();
  const { ratings, prices, place } = Route.useLoaderData();
  const category = resolveChildCategory(parentSlug, childSlug);

  if (!category) return null;

  const parent = getTopLevelSportCategory(parentSlug);
  const parentCategory = parent
    ? { slug: parent.slug, label: parent.label }
    : { slug: parentSlug, label: parentSlug };

  return (
    <CategoryCatalogPage
      key={`${parentSlug}/${childSlug}`}
      category={category}
      parentCategory={parentCategory}
      ratings={ratings}
      prices={prices}
      place={place}
    />
  );
}
