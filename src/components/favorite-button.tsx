import { useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";

import { FavoriteMark } from "@/components/favorite-mark";
import { useFavorites } from "@/components/favorites-store";
import type { FavoriteTarget } from "@/lib/catalog/favorites";

export function FavoriteButton({ target, className }: { target: FavoriteTarget; className: string }) {
  const { user } = useRouteContext({ from: "__root__" });
  const { keys, toggle } = useFavorites();
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const saved = Boolean(user) && keys.includes(`${target.type}:${target.slug}`);

  return (
    <button
      type="button"
      className={`${className}${saved ? " is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={user ? (saved ? "Убрать из избранного" : "В избранное") : "Войдите, чтобы добавить в избранное"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
          const redirect = href.startsWith("/") ? href.split("#")[0].slice(0, 200) : "/";
          void navigate({ to: "/auth/login", search: { redirect } });
          return;
        }
        toggle(target);
      }}
    >
      <FavoriteMark />
    </button>
  );
}
