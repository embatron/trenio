import { createFileRoute, redirect } from "@tanstack/react-router";
import { getTopLevelSportCategory } from "@/lib/catalog/sport-taxonomy";
import { CategoryCatalogPage, resolveChildCategory } from "@/routes/categories.$slug";

export const Route = createFileRoute("/categories/$parentSlug/$childSlug")({
  beforeLoad: ({ params }) => {
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

    const title = `Тренеры — ${category.title} в Беларуси | trenio.by`;
    const desc = `${category.title}: ${category.lead} Подбор по городу, цене, формату и опыту.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ChildCategoryPage,
});

function ChildCategoryPage() {
  const { parentSlug, childSlug } = Route.useParams();
  const category = resolveChildCategory(parentSlug, childSlug);

  if (!category) return null;

  const parent = getTopLevelSportCategory(parentSlug);
  const parentCategory = parent
    ? { slug: parent.slug, label: parent.label }
    : { slug: parentSlug, label: parentSlug };

  return <CategoryCatalogPage category={category} parentCategory={parentCategory} />;
}
