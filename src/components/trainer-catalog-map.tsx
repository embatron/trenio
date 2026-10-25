import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import type { CatalogMapBounds, CatalogMapUser } from "@/components/trainer-catalog-map-view";
import type { MapAreaFeature } from "@/lib/catalog/map-trainers";

type ViewProps = {
  features: MapAreaFeature[];
  user: CatalogMapUser | null;
  focus?: CatalogMapUser | null;
  highlightKeys?: readonly string[];
  onPinHover?: (key: string | null) => void;
  onBounds?: (bounds: CatalogMapBounds) => void;
};

export function TrainerCatalogMap({
  features,
  user,
  located,
  locating,
  onLocate,
  onBounds,
  focus,
  highlightKeys,
  onPinHover,
  empty,
  showEmpty = false,
  loading = false,
}: {
  features: MapAreaFeature[];
  user: CatalogMapUser | null;
  located: boolean;
  locating: boolean;
  onLocate: () => void;
  onBounds?: (bounds: CatalogMapBounds) => void;
  focus?: CatalogMapUser | null;
  highlightKeys?: readonly string[];
  onPinHover?: (key: string | null) => void;
  empty: ReactNode;
  showEmpty?: boolean;
  loading?: boolean;
}) {
  const [View, setView] = useState<ComponentType<ViewProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("./trainer-catalog-map-view")
      .then((mod) => {
        if (!cancelled) setView(() => mod.TrainerCatalogMapView);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="catalog-map" aria-label="Карта тренеров">
      {failed ? (
        <div className="catalog-map__fallback" role="status">
          <p>Карта откроется, когда появится сеть.</p>
          {features.some((feature) => feature.kind === "pin") ? (
            <ul>
              {features.flatMap((feature) => feature.kind === "pin" ? feature.trainers.map((trainer) => (
                <li key={`${feature.key}-${trainer.slug}`}>
                  <Link to="/trainers/$slug" params={{ slug: trainer.slug }}>{trainer.name}</Link>
                  <span>{feature.label}</span>
                </li>
              )) : [])}
            </ul>
          ) : empty}
        </div>
      ) : View ? (
        <View features={features} user={user} focus={focus} highlightKeys={highlightKeys} onPinHover={onPinHover} onBounds={onBounds} />
      ) : (
        <div className="catalog-map__skeleton" role="status">Загрузка карты</div>
      )}
      {!failed && showEmpty ? <div className="catalog-map__empty">{empty}</div> : null}
      {!failed && loading && features.length > 0 ? <p className="catalog-map__status">Обновляем метки</p> : null}
      <button
        type="button"
        className={`catalog-map__locate${located ? " is-on" : ""}`}
        onClick={onLocate}
        aria-pressed={located}
        aria-label={locating ? "Определяем местоположение" : "Моё местоположение"}
        disabled={locating}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      <style>{MAP_SHELL_CSS}</style>
    </div>
  );
}

const MAP_SHELL_CSS = `
.catalog-map {
  position: relative;
  width: 100%;
  height: min(52dvh, 420px);
  min-height: 280px;
  overflow: hidden;
  overflow-anchor: none;
  border-radius: var(--card-radius);
  border: 1px solid rgba(var(--dark-rgb), 0.06);
  box-shadow: 0 14px 42px rgba(var(--dark-rgb), 0.07);
  background: var(--neutral-bg);
}
.catalog-map__skeleton,
.catalog-map__fallback,
.catalog-map__empty {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: var(--muted);
  background: var(--neutral-bg);
}
.catalog-map__empty { pointer-events: none; background: rgba(255, 255, 255, 0.82); }
.catalog-map__empty .cat-empty__btn { pointer-events: auto; }
.catalog-map__fallback { overflow: auto; align-content: start; justify-items: stretch; text-align: left; }
.catalog-map__fallback p { margin: 0; }
.catalog-map__fallback ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.catalog-map__fallback a { color: var(--dark); font-weight: var(--fw-title); text-decoration: none; }
.catalog-map__fallback a:hover { color: var(--primary); }
.catalog-map__fallback span { display: block; color: var(--muted); font-size: 13px; }
.catalog-map__status {
  position: absolute;
  z-index: 4;
  left: 12px;
  bottom: 12px;
  margin: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--white);
  color: var(--muted);
  font-size: 13px;
  box-shadow: 0 8px 20px rgba(var(--dark-rgb), 0.12);
}
.catalog-map__locate {
  position: absolute;
  z-index: 4;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--white);
  color: var(--dark);
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(var(--dark-rgb), 0.12);
}
.catalog-map__locate svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.catalog-map__locate.is-on { color: var(--primary); border-color: var(--primary); }
.catalog-map__locate:disabled { opacity: 0.6; cursor: progress; }
@media (min-width: 960px) {
  .catalog-map { height: min(72dvh, 760px); min-height: 480px; }
}
@media (max-width: 959px) {
  .catalog-map { height: min(42dvh, 320px); min-height: 240px; }
}
`;
