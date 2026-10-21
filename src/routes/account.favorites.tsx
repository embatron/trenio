import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { FavoriteCards } from "@/components/favorite-cards";
import { useFavorites } from "@/components/favorites-store";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/favorites")({
  head: () => ({
    meta: [
      { title: "Избранное · trenio.by" },
      { name: "description", content: "Сохранённые карточки тренеров." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountFavoritesPage,
});

function AccountFavoritesPage() {
  const { ratings } = accountRoute.useLoaderData();
  const { keys, ready } = useFavorites();
  if (!ready) {
    return (
      <article className="cabinet-card">
        <h2>Избранное</h2>
        <p className="cabinet-empty">Загрузка…</p>
      </article>
    );
  }
  return <FavoriteCards keys={keys} ratings={ratings} />;
}
