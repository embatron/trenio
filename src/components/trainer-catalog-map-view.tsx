import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DomEvent,
  circleMarker,
  divIcon,
  map as createMap,
  marker,
  tileLayer,
  type CircleMarker,
  type Map as LeafletMap,
  type Marker,
} from "leaflet";
import "leaflet/dist/leaflet.css";

import { PhotoImage } from "@/components/photo-image";
import { TrainerName } from "@/components/trainer-name";
import { TrainerRating } from "@/components/trainer-rating";

const MINSK: [number, number] = [53.9006, 27.559];
const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" fill="#f04b50" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>`;

export type CatalogMapTrainer = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  photo: string;
  tags: string[];
  rating: string;
  reviews: number;
  price: number;
};

export type CatalogMapPin = {
  key: string;
  lat: number;
  lng: number;
  label: string;
  trainers: CatalogMapTrainer[];
};

export type CatalogMapUser = { lat: number; lng: number };

export type CatalogMapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

function pinIcon(count: number, active: boolean) {
  const badge = count > 1 ? `<span class="catalog-map__count">${count}</span>` : "";
  return divIcon({
    className: "catalog-map__pin",
    html: `<span class="catalog-map__glyph${active ? " is-active" : ""}">${PIN}${badge}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
  });
}

const MINSK_POINT: CatalogMapUser = { lat: MINSK[0], lng: MINSK[1] };

function showPoint(map: LeafletMap, point: CatalogMapUser, zoom: number, programmatic: { current: boolean }) {
  programmatic.current = true;
  map.setView([point.lat, point.lng], zoom);
  programmatic.current = false;
}

export function TrainerCatalogMapView({
  pins,
  user,
  focus,
  onBounds,
}: {
  pins: CatalogMapPin[];
  user: CatalogMapUser | null;
  /** Where the map opens. Minsk when the visitor point is unknown. */
  focus?: CatalogMapUser | null;
  onBounds?: (bounds: CatalogMapBounds) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const youRef = useRef<CircleMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties | null>(null);
  const pinKey = pins.map((pin) => pin.key).join("|");
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const focusKey = focus ? `${focus.lat.toFixed(5)},${focus.lng.toFixed(5)}` : "";
  const movedRef = useRef(false);
  const programmaticRef = useRef(false);
  const userKey = user ? `${user.lat.toFixed(5)},${user.lng.toFixed(5)}` : "";
  const active = pins.find((pin) => pin.key === activeKey) ?? null;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const map = createMap(node, {
      scrollWheelZoom: false,
      attributionControl: false,
      zoomControl: true,
    }).setView(MINSK, 12);
    const noteMove = () => {
      if (!programmaticRef.current) movedRef.current = true;
    };
    map.on("dragstart", noteMove);
    map.on("zoomstart", noteMove);
    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", () => setActiveKey(null));
    mapRef.current = map;
    const report = () => {
      const box = map.getBounds();
      onBoundsRef.current?.({
        south: box.getSouth(),
        west: box.getWest(),
        north: box.getNorth(),
        east: box.getEast(),
      });
    };
    map.on("moveend", report);
    setReady(true);
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    const onResize = () => map.invalidateSize();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveKey(null);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      youRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const item of markersRef.current.values()) item.remove();
    markersRef.current.clear();
    for (const pin of pins) {
      const title = pin.trainers.map((trainer) => trainer.name).join(", ");
      const item = marker([pin.lat, pin.lng], {
        icon: pinIcon(pin.trainers.length, false),
        title,
        alt: title || pin.label,
        keyboard: true,
      }).addTo(map);
      item.on("click", (event) => {
        DomEvent.stopPropagation(event);
        setActiveKey((current) => (current === pin.key ? null : pin.key));
      });
      markersRef.current.set(pin.key, item);
    }
    setActiveKey((current) => (current && pins.some((pin) => pin.key === current) ? current : null));
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
    // User location is fitted in the effect below so a later GPS fix recenters once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    youRef.current?.remove();
    youRef.current = null;
    if (user) {
      youRef.current = circleMarker([user.lat, user.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#f04b50",
        fillOpacity: 1,
      }).addTo(map);
      movedRef.current = true;
      showPoint(map, user, 14, programmaticRef);
    }
  }, [userKey, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || movedRef.current) return;
    showPoint(map, focusRef.current ?? MINSK_POINT, 12, programmaticRef);
  }, [ready, focusKey]);

  useEffect(() => {
    for (const [key, item] of markersRef.current) {
      const pin = pins.find((entry) => entry.key === key);
      if (!pin) continue;
      item.setIcon(pinIcon(pin.trainers.length, key === activeKey));
    }
  }, [activeKey, pins]);

  useEffect(() => {
    const map = mapRef.current;
    const node = nodeRef.current;
    if (!map || !node || !active) {
      setCardStyle(null);
      return;
    }
    const place = () => {
      const point = map.latLngToContainerPoint([active.lat, active.lng]);
      const width = node.clientWidth;
      const cardWidth = Math.min(248, width - 16);
      const left = Math.max(8, Math.min(point.x - cardWidth / 2, width - cardWidth - 8));
      const below = point.y < 150;
      setCardStyle({
        position: "absolute",
        left,
        top: point.y,
        right: "auto",
        bottom: "auto",
        width: cardWidth,
        transform: below ? "translateY(14px)" : "translateY(calc(-100% - 8px))",
      });
    };
    place();
    map.on("move", place);
    map.on("zoom", place);
    return () => {
      map.off("move", place);
      map.off("zoom", place);
    };
  }, [active]);

  return (
    <>
      <div ref={nodeRef} className="catalog-map__leaflet" />
      {active && cardStyle ? (
        <div
          className="catalog-map__card"
          style={cardStyle}
        >
          <button
            type="button"
            className="catalog-map__close"
            aria-label="Закрыть карточку"
            onClick={() => setActiveKey(null)}
          >
            ×
          </button>
          <ul className="catalog-map__people">
            {active.trainers.map((trainer) => (
              <li key={trainer.slug}>
                <Link to="/trainers/$slug" params={{ slug: trainer.slug }}>
                  {trainer.photo ? (
                    <PhotoImage
                      className="catalog-map__photo"
                      src={trainer.photo}
                      alt=""
                      preset="tile"
                      width={48}
                      height={64}
                    />
                  ) : (
                    <span className="catalog-map__photo catalog-map__photo--empty" aria-hidden="true">
                      {(trainer.firstName || trainer.name).slice(0, 1)}
                    </span>
                  )}
                  <span className="catalog-map__copy">
                    <TrainerName firstName={trainer.firstName} lastName={trainer.lastName} />
                    <TrainerRating rating={trainer.rating} reviews={trainer.reviews} />
                    {trainer.tags.length > 0 ? <span className="catalog-map__sport">{trainer.tags.join(", ")}</span> : null}
                    {trainer.price > 0 ? <span className="catalog-map__price">от {trainer.price} BYN</span> : null}
                    <span className="catalog-map__where">{active.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <style>{MAP_VIEW_CSS}</style>
    </>
  );
}

const MAP_VIEW_CSS = `
.catalog-map__leaflet { width: 100%; height: 100%; background: var(--neutral-bg); }
.catalog-map__pin { background: none; border: 0; }
.catalog-map__glyph { position: relative; display: block; width: 36px; height: 36px; }
.catalog-map__glyph.is-active { transform: translateY(-2px) scale(1.08); transform-origin: 50% 100%; }
.catalog-map__count {
  position: absolute; top: -2px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 999px; background: var(--dark); color: #fff; font-size: 11px; font-weight: var(--fw-title);
  line-height: 18px; text-align: center;
}
.catalog-map__card {
  position: absolute; z-index: 3; max-height: min(280px, 70%); overflow: auto;
  padding: 6px; border-radius: 16px; background: var(--white);
  border: 1px solid var(--line); box-shadow: 0 14px 32px rgba(var(--dark-rgb), 0.16);
}
.catalog-map__close {
  position: absolute; top: 4px; right: 4px; z-index: 1; width: 44px; height: 44px;
  border: 0; border-radius: 999px; background: var(--light-bg); color: var(--dark);
  font-size: 22px; line-height: 1; cursor: pointer;
}
.catalog-map__close:hover { color: var(--primary); }
.catalog-map__people { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; clear: both; }
.catalog-map__people a {
  display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; min-height: 44px;
  padding: 2px; border-radius: 12px; color: inherit; text-decoration: none;
}
.catalog-map__people a:hover { background: rgba(var(--primary-rgb), 0.06); }
.catalog-map__photo { width: 48px; height: 64px; object-fit: cover; object-position: top center; border-radius: 10px; display: block; background: var(--light-bg); }
.catalog-map__photo--empty { display: grid; place-items: center; color: var(--primary); font-weight: var(--fw-title); font-size: 18px; }
.catalog-map__copy { min-width: 0; display: grid; gap: 1px; align-content: start; padding: 0 36px 0 0; }
.catalog-map__copy .trainer-name { font-size: 14px; }
.catalog-map__sport, .catalog-map__where { color: var(--muted); font-size: 12px; line-height: 1.3; }
.catalog-map__price { font-size: 13px; font-weight: var(--fw-title); color: var(--dark); }
.catalog-map .leaflet-control-zoom a { width: 44px; height: 44px; line-height: 44px; }
`;
