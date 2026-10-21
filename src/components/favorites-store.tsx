import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { listFavoritesFn, toggleFavoriteFn, type FavoriteTarget } from "@/lib/catalog/favorites";

type FavoritesState = {
  keys: string[];
  ready: boolean;
  toggle: (target: FavoriteTarget) => void;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

function favoriteKey(target: FavoriteTarget) {
  return `${target.type}:${target.slug}`;
}

export function FavoritesProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [ready, setReady] = useState(!userId);
  const keysRef = useRef(keys);
  const requestId = useRef(0);
  keysRef.current = keys;

  useEffect(() => {
    if (!userId) {
      setKeys([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void listFavoritesFn()
      .then((result) => {
        if (!cancelled && requestId.current === 0) setKeys(result.keys);
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback((target: FavoriteTarget) => {
    const id = ++requestId.current;
    const key = favoriteKey(target);
    const previous = keysRef.current;
    const next = previous.includes(key) ? previous.filter((item) => item !== key) : [key, ...previous];
    setKeys(next);
    void toggleFavoriteFn({ data: target })
      .then((result) => {
        if (requestId.current === id) setKeys(result.keys);
      })
      .catch(() => {
        if (requestId.current !== id) return;
        void listFavoritesFn()
          .then((result) => {
            if (requestId.current === id) setKeys(result.keys);
          })
          .catch(() => {
            if (requestId.current === id) setKeys(previous);
          });
      });
  }, []);

  return <FavoritesContext.Provider value={{ keys, ready, toggle }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("Избранное доступно только внутри кабинета сайта.");
  return value;
}
