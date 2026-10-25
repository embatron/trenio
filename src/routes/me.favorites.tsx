import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { FavoriteCards } from "@/components/favorite-cards";
import { useFavorites } from "@/components/favorites-store";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/favorites")({
  head: () => ({
    meta: [
      { title: "Избранное · trenio.by" },
      { name: "description", content: "Сохранённые карточки тренеров." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeFavoritesPage,
});

function MeFavoritesPage() {
  const { ratings, prices } = meRoute.useLoaderData();
  const { keys, ready } = useFavorites();
  if (!ready) {
    return (
      <article className="cabinet-card">
        <h2>Избранное</h2>
        <p className="cabinet-empty">Загрузка…</p>
      </article>
    );
  }
  return <FavoriteCards keys={keys} ratings={ratings} prices={prices} />;
}
