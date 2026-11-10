import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import {
  categoryChildRoute,
  categorySearchDescription,
  getTopLevelSportCategory,
  getSportTaxonomyChildInCategory,
} from "@/lib/catalog/sport-taxonomy";
import { categoryRouteHead } from "@/lib/seo/catalog";
import { documentLead, siteTitle } from "@/lib/seo/site";
import { listCatalogTrainersFn } from "@/lib/catalog/catalog-trainers";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { resolveVisitorPlaceFn } from "@/lib/catalog/visitor-place";
import {
  CategoryCatalogPage,
  categoryHeroLead,
  categoryPageTitle,
  categoryVoice,
  resolveChildCategory,
} from "@/routes/categories.$slug";

export const Route = createFileRoute("/categories/$parentSlug/$childSlug")({
  beforeLoad: ({ params }) => {
    const load = categoryChildRoute(params.parentSlug, params.childSlug);
    if (load.kind === "child") {
      throw redirect({
        to: "/categories/$parentSlug/$childSlug",
        params: { parentSlug: load.parentSlug, childSlug: load.childSlug },
      });
    }
    if (load.kind === "parent") {
      throw redirect({
        to: "/categories/$slug",
        params: { slug: load.parentSlug },
      });
    }
    if (load.kind === "missing") throw notFound();
  },
  head: ({ params }) => {
    const category = resolveChildCategory(params.parentSlug, params.childSlug);
    if (!category) {
      return { meta: [{ title: siteTitle("Категория") }] };
    }

    const voice = categoryVoice(category, params.parentSlug);
    const title = categoryPageTitle(voice.keyword, voice.po);
    const aliases = getSportTaxonomyChildInCategory(params.parentSlug, params.childSlug)?.aliases;
    const desc = categorySearchDescription(
      documentLead(title),
      categoryHeroLead(voice.keyword, [], aliases, voice.po),
      aliases,
    );
    const path = `/categories/${params.parentSlug}/${params.childSlug}`;
    const parent = getTopLevelSportCategory(params.parentSlug);
    return categoryRouteHead({
      title,
      description: desc,
      path,
      parentSlug: params.parentSlug,
      faq: category.faq,
      crumbs: [
        { name: "Главная", path: "/" },
        { name: "Категории", path: "/categories" },
        { name: parent?.label ?? params.parentSlug, path: `/categories/${params.parentSlug}` },
        { name: category.title, path },
      ],
    });
  },
  loader: async () => {
    const [ratings, prices, place, trainers] = await Promise.all([
      listTrainerRatingSummariesFn(),
      listTrainerPricesFn(),
      resolveVisitorPlaceFn(),
      listCatalogTrainersFn(),
    ]);
    return { ratings, prices, place, trainers };
  },
  component: ChildCategoryPage,
});

function ChildCategoryPage() {
  const { parentSlug, childSlug } = Route.useParams();
  const { ratings, prices, place, trainers } = Route.useLoaderData();
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
      trainers={trainers}
    />
  );
}
