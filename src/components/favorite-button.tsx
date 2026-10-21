import { useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";

import { useFavorites } from "@/components/favorites-store";
import type { FavoriteTarget } from "@/lib/catalog/favorites";

const HEART_PATH =
  "M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z";

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
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={HEART_PATH} />
      </svg>
    </button>
  );
}
