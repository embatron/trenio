import { createFileRoute } from "@tanstack/react-router";
import { CatalogMiss } from "@/components/catalog-miss";

export const Route = createFileRoute("/403")({
  head: () => ({
    meta: [
      { title: "Нет доступа | trenio.by" },
      { name: "description", content: "Эта страница закрыта. Каталог и поиск остаются открытыми." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ClosedPage,
});

function ClosedPage() {
  return (
    <CatalogMiss
      code="403"
      title="Сюда без пропуска"
      text="Эта страница закрыта. Каталог, карта и поиск остаются открытыми."
    />
  );
}
