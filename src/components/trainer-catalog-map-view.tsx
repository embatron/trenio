import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
import type { MapAreaFeature } from "@/lib/catalog/map-trainers";
import { countRu } from "@/lib/ru-plural";

const MINSK: [number, number] = [53.9006, 27.559];
const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" fill="currentColor" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>`;

export type CatalogMapUser = { lat: number; lng: number };

export type CatalogMapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

function pinIcon(count: number, mode: "idle" | "lit" | "dim") {
  const badge = count > 1 ? `<span class="catalog-map__count">${count}</span>` : "";
  return divIcon({
    className: "catalog-map__pin",
    html: `<span class="catalog-map__glyph is-${mode}">${PIN}${badge}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
  });
}

function clusterLabel(count: number) {
  if (count < 1000) return String(count);
  if (count < 1_000_000) {
    const value = count / 1000;
    const text = value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10).replace(".", ",");
    return `${text}к`;
  }
  const value = count / 1_000_000;
  const text = value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10).replace(".", ",");
  return `${text}м`;
}

function clusterIcon(count: number) {
  const size = count >= 1000 ? 56 : count >= 100 ? 50 : count >= 10 ? 44 : 40;
  return divIcon({
    className: "catalog-map__cluster",
    html: `<span class="catalog-map__bubble" style="width:${size}px;height:${size}px">${clusterLabel(count)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function litPinKeys(features: MapAreaFeature[], openKey: string | null, highlightKeys: readonly string[]) {
  const lit = new Set<string>(highlightKeys);
  const open = features.find((feature) => feature.kind === "pin" && feature.key === openKey);
  if (open?.kind === "pin") {
    const slugs = new Set(open.slugs);
    lit.add(open.key);
    for (const feature of features) {
      if (feature.kind === "pin" && feature.slugs.some((slug) => slugs.has(slug))) lit.add(feature.key);
    }
  }
  return lit;
}

const MINSK_POINT: CatalogMapUser = { lat: MINSK[0], lng: MINSK[1] };
const TIP_EDGE = 8;
const TIP_LIST_CAP = 320;

function tipPlacement(input: {
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  naturalHeight: number;
  peopleHeight: number;
  peopleScroll: number;
}) {
  const width = Math.min(248, Math.max(160, input.mapWidth - TIP_EDGE * 2));
  const left = Math.max(TIP_EDGE, Math.min(input.x - width / 2, input.mapWidth - width - TIP_EDGE));
  const chrome = Math.max(0, input.naturalHeight - input.peopleHeight);
  const spaceAbove = input.y - 16 - TIP_EDGE;
  const spaceBelow = input.mapHeight - input.y - 22 - TIP_EDGE;
  const below = spaceAbove < input.naturalHeight && spaceBelow > spaceAbove;
  const room = Math.max(0, below ? spaceBelow : spaceAbove);
  const peopleMax = Math.min(input.peopleScroll, TIP_LIST_CAP, Math.max(0, room - chrome));
  return {
    left,
    width,
    below,
    peopleMax,
    transform: below ? "translateY(14px)" : "translateY(calc(-100% - 8px))",
  };
}

function showPoint(map: LeafletMap, point: CatalogMapUser, zoom: number, programmatic: { current: boolean }) {
  programmatic.current = true;
  map.setView([point.lat, point.lng], zoom);
  programmatic.current = false;
}

export function TrainerCatalogMapView({
  features,
  user,
  focus,
  highlightKeys = [],
  onPinHover,
  onBounds,
}: {
  features: MapAreaFeature[];
  user: CatalogMapUser | null;
  /** Where the map opens. Minsk when the visitor point is unknown. */
  focus?: CatalogMapUser | null;
  /** Pin keys of the trainer card under the pointer. */
  highlightKeys?: readonly string[];
  onPinHover?: (key: string | null) => void;
  onBounds?: (bounds: CatalogMapBounds) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const youRef = useRef<CircleMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties | null>(null);
  const [tipBelow, setTipBelow] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const pinClickRef = useRef(false);
  const pinnedRef = useRef<string | null>(null);
  const featureKey = features.map((feature) => `${feature.kind}:${feature.key}:${feature.count}`).join("|");
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const focusKey = focus ? `${focus.lat.toFixed(5)},${focus.lng.toFixed(5)}` : "";
  const movedRef = useRef(false);
  const programmaticRef = useRef(false);
  const userKey = user ? `${user.lat.toFixed(5)},${user.lng.toFixed(5)}` : "";
  const openKey = hoverKey ?? pinnedKey;
  pinnedRef.current = pinnedKey;
  const activeFeature = features.find((feature) => feature.key === openKey) ?? null;
  const active = activeFeature?.kind === "pin" ? activeFeature : null;
  const onPinHoverRef = useRef(onPinHover);
  onPinHoverRef.current = onPinHover;

  const holdPin = (key: string) => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    setHoverKey(key);
  };

  const releasePin = () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHoverKey(null), 160);
  };

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const start = focusRef.current ?? MINSK_POINT;
    const map = createMap(node, {
      scrollWheelZoom: false,
      attributionControl: false,
      zoomControl: true,
      keyboard: false,
    }).setView([start.lat, start.lng], 12);
    map.getContainer().tabIndex = -1;
    for (const link of map.getContainer().querySelectorAll<HTMLAnchorElement>(".leaflet-control a")) {
      link.addEventListener("click", (event) => event.preventDefault());
    }
    const noteMove = () => {
      if (!programmaticRef.current) movedRef.current = true;
    };
    map.on("dragstart", noteMove);
    map.on("zoomstart", noteMove);
    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", () => {
      if (pinClickRef.current) {
        pinClickRef.current = false;
        return;
      }
      setHoverKey(null);
      setPinnedKey(null);
    });
    mapRef.current = map;
    const report = () => {
      const box = map.getBounds();
      onBoundsRef.current?.({
        south: box.getSouth(),
        west: box.getWest(),
        north: box.getNorth(),
        east: box.getEast(),
        zoom: map.getZoom(),
      });
    };
    map.on("moveend", report);
    setReady(true);
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      report();
    });
    const onResize = () => {
      map.invalidateSize();
      report();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHoverKey(null);
        setPinnedKey(null);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
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
    const next = new Map(featuresRef.current.map((feature) => [feature.key, feature]));
    for (const [key, item] of markersRef.current) {
      if (!next.has(key)) {
        item.remove();
        markersRef.current.delete(key);
      }
    }
    for (const feature of featuresRef.current) {
      const existing = markersRef.current.get(feature.key);
      if (existing) {
        const node = existing.getElement();
        if (node && node.dataset.count !== String(feature.count)) {
          existing.setIcon(feature.kind === "cluster" ? clusterIcon(feature.count) : pinIcon(feature.count, "idle"));
          const updated = existing.getElement();
          if (updated) updated.dataset.count = String(feature.count);
        }
        continue;
      }
      const item = feature.kind === "cluster"
        ? marker([feature.lat, feature.lng], {
          icon: clusterIcon(feature.count),
          keyboard: false,
          zIndexOffset: 40,
          alt: countRu(feature.count, "тренер", "тренера", "тренеров"),
        })
        : marker([feature.lat, feature.lng], {
          icon: pinIcon(feature.count, "idle"),
          keyboard: false,
          alt: feature.label,
        });
      item.addTo(map);
      if (feature.kind === "cluster") {
        item.on("click", (event) => {
          DomEvent.stop(event);
          pinClickRef.current = true;
          movedRef.current = true;
          map.setView([feature.lat, feature.lng], Math.min(map.getZoom() + 2, 16));
        });
      } else {
        item.on("mouseover", () => holdPin(feature.key));
        item.on("mouseout", () => releasePin());
        item.on("click", (event) => {
          DomEvent.stop(event);
          pinClickRef.current = true;
          if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
          const opened = pinnedRef.current === feature.key ? null : feature.key;
          pinnedRef.current = opened;
          setPinnedKey(opened);
          setHoverKey(opened);
        });
      }
      const placed = item.getElement();
      if (placed) placed.dataset.count = String(feature.count);
      markersRef.current.set(feature.key, item);
    }
    const keep = (current: string | null) => (current && next.has(current) && next.get(current)?.kind === "pin" ? current : null);
    setHoverKey(keep);
    setPinnedKey((current) => {
      const nextKey = keep(current);
      pinnedRef.current = nextKey;
      return nextKey;
    });
    // Markers are added and removed by key. The map view itself stays where the user left it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKey, ready]);

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
    if (!map || !ready) return;
    const next = focusRef.current ?? MINSK_POINT;
    const center = map.getCenter();
    const same = Math.abs(center.lat - next.lat) < 0.0001
      && Math.abs(center.lng - next.lng) < 0.0001
      && map.getZoom() === 12;
    if (same) return;
    showPoint(map, next, 12, programmaticRef);
  }, [ready, focusKey]);

  useEffect(() => {
    const lit = litPinKeys(featuresRef.current, openKey, highlightKeys);
    const dim = lit.size > 0;
    for (const [key, item] of markersRef.current) {
      const glyph = item.getElement()?.querySelector(".catalog-map__glyph");
      if (!glyph) continue;
      const mode = lit.has(key) ? "lit" : dim ? "dim" : "idle";
      glyph.classList.remove("is-idle", "is-lit", "is-dim");
      glyph.classList.add(`is-${mode}`);
      item.setZIndexOffset(lit.has(key) ? 600 : 0);
    }
  }, [openKey, highlightKeys, featureKey]);

  useEffect(() => {
    const feature = featuresRef.current.find((entry) => entry.key === openKey);
    onPinHoverRef.current?.(feature?.kind === "pin" ? feature.key : null);
  }, [openKey, featureKey]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    const node = nodeRef.current;
    if (!map || !node || !active) {
      setCardStyle(null);
      return;
    }
    const place = () => {
      const tip = tipRef.current;
      if (!tip) return;
      const point = map.latLngToContainerPoint([active.lat, active.lng]);
      tip.style.width = `${Math.min(248, Math.max(160, node.clientWidth - TIP_EDGE * 2))}px`;
      const people = tip.querySelector<HTMLElement>(".catalog-map__people");
      const locked = people?.style.maxHeight ?? "";
      if (people) people.style.maxHeight = "none";
      const naturalHeight = tip.offsetHeight;
      const peopleHeight = people?.offsetHeight ?? 0;
      const peopleScroll = people?.scrollHeight ?? peopleHeight;
      if (people) people.style.maxHeight = locked;
      const next = tipPlacement({
        x: point.x,
        y: point.y,
        mapWidth: node.clientWidth,
        mapHeight: node.clientHeight,
        naturalHeight,
        peopleHeight,
        peopleScroll,
      });
      setTipBelow(next.below);
      setCardStyle((current) => {
        const style: CSSProperties = {
          position: "absolute",
          left: next.left,
          top: point.y,
          right: "auto",
          bottom: "auto",
          width: next.width,
          transform: next.transform,
          "--people-max": `${Math.round(next.peopleMax)}px`,
        };
        if (
          current?.left === style.left
          && current.top === style.top
          && current.width === style.width
          && current.transform === style.transform
          && current["--people-max"] === style["--people-max"]
        ) return current;
        return style;
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
      {active ? (
        <div
          ref={tipRef}
          className={`catalog-map__tip${tipBelow ? " is-below" : " is-above"}`}
          style={cardStyle ?? { position: "absolute", visibility: "hidden" }}
          onMouseEnter={() => holdPin(active.key)}
          onMouseLeave={releasePin}
        >
          {pinnedKey === active.key ? (
            <button
              type="button"
              className="catalog-map__close"
              aria-label="Закрыть"
              onClick={() => setPinnedKey(null)}
            >
              ×
            </button>
          ) : null}
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
                    <span className="catalog-map__price">{trainer.price > 0 ? `От ${trainer.price} BYN` : "договорная"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="catalog-map__where">{active.label}</p>
          {active.count > active.trainers.length ? (
            <p className="catalog-map__more">Ещё {active.count - active.trainers.length} в списке рядом</p>
          ) : null}
        </div>
      ) : null}
      <style>{MAP_VIEW_CSS}</style>
    </>
  );
}

const MAP_VIEW_CSS = `
.catalog-map__leaflet { width: 100%; height: 100%; background: var(--neutral-bg); overflow-anchor: none; }
.catalog-map__pin, .catalog-map__cluster { background: none; border: 0; }
.catalog-map__pin { animation: map-mark-in 0.28s ease; }
.catalog-map__bubble {
  display: grid; place-items: center; border-radius: 999px; background: var(--primary); color: #fff;
  border: 2px solid #fff; box-shadow: 0 8px 18px rgba(var(--primary-rgb), 0.35);
  font-size: 13px; font-weight: var(--fw-title); line-height: 1; animation: map-mark-in 0.28s ease;
}
@keyframes map-mark-in { from { opacity: 0; } to { opacity: 1; } }
.catalog-map__glyph { position: relative; display: block; width: 36px; height: 36px; color: var(--primary); transform-origin: 50% 100%; transition: transform 0.16s ease, opacity 0.16s ease, filter 0.16s ease, color 0.16s ease; }
.catalog-map__glyph.is-lit { color: var(--primary); transform: translateY(-4px) scale(1.14); filter: drop-shadow(0 8px 10px rgba(var(--primary-rgb), 0.5)); }
.catalog-map__glyph.is-dim { color: #c5c9d1; opacity: 1; }
.catalog-map__count {
  position: absolute; top: -2px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 999px; background: var(--dark); color: #fff; font-size: 11px; font-weight: var(--fw-title);
  line-height: 18px; text-align: center;
}
.catalog-map__tip {
  position: absolute; z-index: 1000; display: grid; gap: 6px; box-sizing: border-box;
  padding: 8px 8px 10px; border-radius: 16px; background: var(--white);
  border: 1px solid rgba(var(--primary-rgb), 0.28);
  box-shadow: 0 16px 36px rgba(var(--primary-rgb), 0.18);
}
.catalog-map__tip::before {
  content: ""; position: absolute; left: 14px; right: 14px; height: 3px; border-radius: 999px; background: var(--primary);
}
.catalog-map__tip.is-above::before { top: 6px; }
.catalog-map__tip.is-below::before { bottom: 6px; }
.catalog-map__tip::after {
  content: ""; position: absolute; left: 50%; width: 12px; height: 12px; background: var(--white);
  border-right: 1px solid rgba(var(--primary-rgb), 0.28); border-bottom: 1px solid rgba(var(--primary-rgb), 0.28);
}
.catalog-map__tip.is-above::after { bottom: -7px; transform: translateX(-50%) rotate(45deg); }
.catalog-map__tip.is-below::after { top: -7px; transform: translateX(-50%) rotate(225deg); }
.catalog-map__close {
  position: absolute; top: 4px; right: 4px; z-index: 1; width: 44px; height: 44px;
  border: 0; border-radius: 999px; background: var(--light-bg); color: var(--dark);
  font-size: 22px; line-height: 1; cursor: pointer;
}
.catalog-map__close:hover { color: var(--primary); }
.catalog-map__people { list-style: none; margin: 0; padding: 8px 0 0; display: grid; gap: 4px; min-height: 0; max-height: var(--people-max, min(320px, 46dvh)); overflow: auto; overscroll-behavior: contain; }
.catalog-map__people a {
  display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; min-height: 44px;
  padding: 4px; border-radius: 12px; color: inherit; text-decoration: none;
}
.catalog-map__people a:hover { background: rgba(var(--primary-rgb), 0.08); }
.catalog-map__photo { width: 48px; height: 64px; object-fit: cover; object-position: top center; border-radius: 10px; display: block; background: var(--light-bg); }
.catalog-map__photo--empty { display: grid; place-items: center; color: var(--primary); font-weight: var(--fw-title); font-size: 18px; }
.catalog-map__copy { min-width: 0; display: grid; gap: 1px; align-content: start; }
.catalog-map__tip:has(.catalog-map__close) .catalog-map__copy { padding-right: 36px; }
.catalog-map__copy .trainer-name { font-size: 14px; }
.catalog-map__sport { color: var(--muted); font-size: 12px; line-height: 1.3; }
.catalog-map__where, .catalog-map__more { margin: 0; padding: 0 6px 2px; color: var(--muted); font-size: 12px; line-height: 1.3; }
.catalog-map__price { font-size: 13px; font-weight: var(--fw-title); color: var(--dark); }
.catalog-map .leaflet-control-zoom a { width: 44px; height: 44px; line-height: 44px; }
`;
