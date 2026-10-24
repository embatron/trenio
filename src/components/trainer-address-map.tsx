import { useEffect, useRef, useState, type ComponentType } from "react";

import { YandexIcon } from "@/components/brand-icons";
import { placeLine } from "@/lib/geo/schemas";
import type { TrainerMapPoint } from "@/components/trainer-address-map-view";

type MapViewProps = { points: TrainerMapPoint[]; activeLat: number; activeLng: number };

export type TrainerProfilePlace = {
  city: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

function hasPoint(place: TrainerProfilePlace) {
  return place.lat != null && place.lng != null && Number.isFinite(place.lat) && Number.isFinite(place.lng);
}

export function TrainerAddressMap({ places }: { places: TrainerProfilePlace[] }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const listed = places.filter((place) => placeLine(place));
  const points: TrainerMapPoint[] = listed.flatMap((place) => (
    hasPoint(place) ? [{ lat: place.lat as number, lng: place.lng as number, label: placeLine(place) }] : []
  ));
  const firstMapped = listed.findIndex(hasPoint);
  const [active, setActive] = useState(firstMapped >= 0 ? firstMapped : 0);
  const [held, setHeld] = useState<{ lat: number; lng: number } | null>(null);
  const [MapView, setMapView] = useState<ComponentType<MapViewProps> | null>(null);
  const [failed, setFailed] = useState(false);
  const safeActive = active >= 0 && active < listed.length ? active : 0;
  const focus = listed[safeActive];
  const selectedPoint = focus && hasPoint(focus) ? focus : null;
  const fallbackPoint = listed.find(hasPoint) ?? null;
  const mapPoint = selectedPoint ?? held ?? fallbackPoint;
  const pointKey = points.map((point) => `${point.lat},${point.lng}`).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    let cancelled = false;
    void import("./trainer-address-map-view")
      .then((mod) => {
        if (!cancelled) setMapView(() => mod.TrainerAddressMapView);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pointKey, points.length]);

  if (listed.length === 0) return null;
  const route = selectedPoint
    ? `https://yandex.by/maps/?rtext=~${selectedPoint.lat},${selectedPoint.lng}&rtt=auto`
    : "";

  function show(index: number) {
    setActive(index);
    const place = listed[index];
    if (!place || !hasPoint(place)) return;
    setHeld({ lat: place.lat as number, lng: place.lng as number });
    canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <section className="profile-block trainer-address">
      <h2 className="profile-heading">Где я тренирую</h2>
      <ol className="trainer-places">
        {listed.map((place, index) => (
          <li key={`${placeLine(place)}-${index}`}>
            <button
              type="button"
              className={index === safeActive ? "is-active" : undefined}
              aria-pressed={index === safeActive}
              onClick={() => show(index)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
                <circle cx="12" cy="9" r="2.4" />
              </svg>
              <span>{placeLine(place)}</span>
            </button>
          </li>
        ))}
      </ol>
      {points.length > 0 ? (
        <>
          <div className="trainer-address__canvas" ref={canvasRef}>
            {failed || !MapView || !mapPoint ? (
              <div className="trainer-address__skeleton" role="status">
                {failed ? "Карта откроется, когда появится сеть." : "Загрузка карты"}
              </div>
            ) : (
              <MapView
                points={points}
                activeLat={mapPoint.lat as number}
                activeLng={mapPoint.lng as number}
              />
            )}
          </div>
          {route ? <a className="btn btn--secondary trainer-address__route" href={route} target="_blank" rel="noopener noreferrer">
            <YandexIcon />
            Проложить маршрут
          </a> : null}
        </>
      ) : null}
      <style>{ADDRESS_MAP_CSS}</style>
    </section>
  );
}

const ADDRESS_MAP_CSS = `
.trainer-address { min-width: 0; }
.trainer-places { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }
.trainer-places button {
  min-height: 44px;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--light-bg);
  color: var(--dark);
  font: inherit;
  font-size: 14px;
  font-weight: var(--fw-ui);
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}
.trainer-places button svg { width: 16px; height: 16px; flex: 0 0 auto; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.trainer-places button span { min-width: 0; }
.trainer-places button.is-active { color: var(--primary-dark); box-shadow: inset 0 0 0 1px var(--primary); }
.trainer-address__canvas {
  position: relative;
  z-index: 0;
  isolation: isolate;
  width: 100%;
  max-width: 100%;
  height: 240px;
  overflow: hidden;
  border-radius: var(--card-radius);
  border: 1px solid rgba(var(--dark-rgb), 0.06);
  box-shadow: 0 14px 42px rgba(var(--dark-rgb), 0.07);
  background: var(--neutral-bg);
}
.trainer-address__leaflet { width: 100%; height: 100%; }
.trainer-address__skeleton {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--muted);
  font-size: 14px;
  font-weight: var(--fw-title);
  text-align: center;
  padding: 16px;
}
.trainer-address__pin { background: transparent !important; border: 0 !important; }
.trainer-address__canvas .leaflet-container { width: 100%; height: 100%; font: inherit; }
.trainer-address__canvas .leaflet-container img { max-width: none; }
.trainer-address__canvas .leaflet-control-zoom a { width: 44px; height: 44px; line-height: 44px; }
.trainer-address__canvas .leaflet-control-attribution { display: none; }
.trainer-address__route { width: 100%; }
.trainer-address__route .yandex-mark { stroke: none; }
.trainer-address__route .yandex-mark circle { fill: #fc3f1d; stroke: none; }
.trainer-address__route .yandex-mark path { fill: #fff; stroke: none; }
@media (min-width: 768px) {
  .trainer-address__canvas { height: 280px; }
  .trainer-address__route { width: fit-content; }
}
`;