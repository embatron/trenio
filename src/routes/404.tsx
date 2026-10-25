import { createFileRoute } from "@tanstack/react-router";
import { CatalogMiss } from "@/components/catalog-miss";

export const Route = createFileRoute("/404")({
  head: () => ({
    meta: [
      { title: "Страница не найдена | trenio.by" },
      { name: "description", content: "Такой страницы нет. Найдите тренера по виду спорта и городу." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: MissingPage,
});

function MissingPage() {
  return (
    <CatalogMiss
      code="404"
      title="Мяч ушёл за линию"
      text="Такой страницы нет. Выберите вид спорта и город — найдём тренера."
    />
  );
}
