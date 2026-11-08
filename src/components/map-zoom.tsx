import type { RefObject } from "react";

import type { YandexMap } from "@/lib/maps/yandex-maps";

const MIN_ZOOM = 2;
const MAX_ZOOM = 19;

export function MapZoom({ mapRef }: { mapRef: RefObject<YandexMap | null> }) {
  function step(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.zoom + delta));
    map.setLocation({ center: map.center, zoom });
  }

  return (
    <div className="map-zoom">
      <button type="button" aria-label="Приблизить" onClick={() => step(1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
      <button type="button" aria-label="Отдалить" onClick={() => step(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <style>{MAP_ZOOM_CSS}</style>
    </div>
  );
}

const MAP_ZOOM_CSS = `
.map-zoom {
  position: absolute;
  z-index: 4;
  top: 12px;
  left: 12px;
  display: grid;
  width: 44px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(var(--dark-rgb), 0.12);
  overflow: hidden;
}
.map-zoom button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dark);
  cursor: pointer;
}
.map-zoom button + button { box-shadow: inset 0 1px 0 var(--line); }
.map-zoom svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
  fill: none;
  stroke-linecap: round;
}
.catalog-map [class*="gototech"],
.trainer-address__canvas [class*="gototech"],
.catalog-map [class*="gototaxi"],
.trainer-address__canvas [class*="gototaxi"] { display: none !important; }
.catalog-map [class$="-copyright"],
.trainer-address__canvas [class$="-copyright"] { transform: translate(-28px, -14px); }
.catalog-map [class*="map-copyrights-promo"],
.trainer-address__canvas [class*="map-copyrights-promo"] { transform: translate(8px, -10px); }
`;
