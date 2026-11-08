import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type TipStyle = CSSProperties & { "--people-max"?: string };

import { PhotoImage } from "@/components/photo-image";
import { TrainerName } from "@/components/trainer-name";
import { TrainerRating } from "@/components/trainer-rating";
import type { MapAreaFeature } from "@/lib/catalog/map-trainers";
import { MAP_TOOLTIP_CAP } from "@/lib/catalog/map-limits";
import { capMapFeatures } from "@/lib/catalog/map-window";
import {
  loadYandexMaps,
  mountYandexMap,
  quietMapChrome,
  type YandexMap,
  type YandexMarker,
} from "@/lib/maps/yandex-maps";
import { countRu } from "@/lib/ru-plural";

const MINSK: [number, number] = [53.9006, 27.559];
const DESKTOP_OPEN_ZOOM = 12;
const PHONE_OPEN_ZOOM = 11;
const PIN_ANCHOR_X = 18;
const PIN_ANCHOR_Y = 34;

/** The phone map is shorter, so the same zoom leaves nearby trainers outside the frame. */
function openingZoom() {
  return window.matchMedia("(max-width: 959px)").matches ? PHONE_OPEN_ZOOM : DESKTOP_OPEN_ZOOM;
}
const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" fill="currentColor" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>`;

export type CatalogMapUser = { lat: number; lng: number };

export type CatalogMapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

function pinHtml(count: number) {
  const badge = count > 1 ? `<span class="catalog-map__count">${count}</span>` : "";
  return `<span class="catalog-map__glyph is-idle">${PIN}${badge}</span>`;
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

function clusterHtml(count: number) {
  const size = count >= 1000 ? 56 : count >= 100 ? 50 : count >= 10 ? 44 : 40;
  return { size, html: `<span class="catalog-map__bubble" style="width:${size}px;height:${size}px">${clusterLabel(count)}</span>` };
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

type Placed = { marker: YandexMarker; element: HTMLElement };

function markerShape(element: HTMLElement): [[number, number], [number, number]] {
  if (element.dataset.kind === "cluster") {
    const size = Number.parseFloat(element.style.width) || 40;
    const half = size / 2;
    return [[-half, -half], [half, half]];
  }
  return [[-18, -34], [18, 2]];
}

function paintFeature(element: HTMLElement, feature: MapAreaFeature) {
  if (feature.kind === "cluster") {
    const bubble = clusterHtml(feature.count);
    element.className = "catalog-map__cluster";
    element.style.width = `${bubble.size}px`;
    element.style.height = `${bubble.size}px`;
    element.innerHTML = bubble.html;
    element.setAttribute("aria-label", countRu(feature.count, "тренер", "тренера", "тренеров"));
  } else {
    element.className = "catalog-map__pin";
    element.style.width = "";
    element.style.height = "";
    element.innerHTML = pinHtml(feature.count);
    element.setAttribute("aria-label", feature.label);
  }
  element.dataset.count = String(feature.count);
  element.dataset.kind = feature.kind;
}

export function TrainerCatalogMapView({
  features: incomingFeatures,
  user,
  focus,
  highlightKeys = [],
  onPinHover,
  onBounds,
  onUnavailable,
}: {
  features: MapAreaFeature[];
  user: CatalogMapUser | null;
  /** Where the map opens. Minsk when the visitor point is unknown. */
  focus?: CatalogMapUser | null;
  /** Pin keys of the trainer card under the pointer. */
  highlightKeys?: readonly string[];
  onPinHover?: (key: string | null) => void;
  onBounds?: (bounds: CatalogMapBounds) => void;
  onUnavailable?: () => void;
}) {
  const features = capMapFeatures(incomingFeatures);
  const nodeRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const markersRef = useRef<Map<string, Placed>>(new Map());
  const youRef = useRef<YandexMarker | null>(null);
  const moveListeners = useRef(new Set<() => void>());
  const [ready, setReady] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<TipStyle | null>(null);
  const [tipBelow, setTipBelow] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const pinClickRef = useRef(false);
  const pinnedRef = useRef<string | null>(null);
  const suppressHoverRef = useRef(0);
  const featureKey = features.map((feature) => `${feature.kind}:${feature.key}:${feature.count}`).join("|");
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const focusKey = focus ? `${focus.lat.toFixed(5)},${focus.lng.toFixed(5)}` : "";
  const userKey = user ? `${user.lat.toFixed(5)},${user.lng.toFixed(5)}` : "";
  const openKey = hoverKey ?? pinnedKey;
  pinnedRef.current = pinnedKey;
  const activeFeature = features.find((feature) => feature.key === openKey) ?? null;
  const active = activeFeature?.kind === "pin" ? activeFeature : null;
  const onPinHoverRef = useRef(onPinHover);
  onPinHoverRef.current = onPinHover;

  const dismissTip = (event?: { preventDefault: () => void; stopPropagation: () => void }) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    pinnedRef.current = null;
    suppressHoverRef.current = Date.now() + 350;
    setPinnedKey(null);
    setHoverKey(null);
  };
  const dismissRef = useRef(dismissTip);
  dismissRef.current = dismissTip;

  const holdPin = (key: string) => {
    if (Date.now() < suppressHoverRef.current) return;
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    setHoverKey(key);
  };

  const releasePin = () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHoverKey(null), 160);
  };
  const holdRef = useRef(holdPin);
  const releaseRef = useRef(releasePin);
  holdRef.current = holdPin;
  releaseRef.current = releasePin;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let cancelled = false;
    let map: YandexMap | null = null;
    const fail = () => {
      if (!cancelled) onUnavailableRef.current?.();
    };
    const report = () => {
      const current = mapRef.current;
      const box = current?.bounds;
      if (!current || !box) return;
      const lngs = [box[0][0], box[1][0]];
      const lats = [box[0][1], box[1][1]];
      onBoundsRef.current?.({
        west: Math.min(...lngs),
        east: Math.max(...lngs),
        south: Math.min(...lats),
        north: Math.max(...lats),
        zoom: current.zoom,
      });
    };
    void loadYandexMaps()
      .then(async (ymaps) => {
        if (cancelled) return;
        const start = focusRef.current ?? MINSK_POINT;
        map = mountYandexMap(ymaps, node, [start.lng, start.lat], openingZoom());
        map.onClick(() => {
          if (pinClickRef.current) {
            pinClickRef.current = false;
            return;
          }
          dismissRef.current();
        });
        map.onMove(() => {
          for (const listener of moveListeners.current) listener();
        });
        map.onIdle(() => {
          for (const listener of moveListeners.current) listener();
          report();
        });
        map.onResize(() => {
          for (const listener of moveListeners.current) listener();
          report();
        });
        mapRef.current = map;
        setReady(true);
        window.requestAnimationFrame(() => {
          quietMapChrome(node);
          report();
        });
      })
      .catch(fail);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
      map?.destroy();
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
        item.marker.remove();
        markersRef.current.delete(key);
      }
    }
    for (const feature of featuresRef.current) {
      const existing = markersRef.current.get(feature.key);
      if (existing) {
        if (existing.element.dataset.count !== String(feature.count)) paintFeature(existing.element, feature);
        continue;
      }
      const element = document.createElement("div");
      paintFeature(element, feature);
      const marker = map.addMarker({
        coordinates: [feature.lng, feature.lat],
        element,
        zIndex: feature.kind === "cluster" ? 40 : 0,
        shape: markerShape(element),
        onClick: feature.kind === "cluster"
          ? () => {
            pinClickRef.current = true;
            const current = mapRef.current;
            if (!current) return;
            current.setLocation({
              center: [feature.lng, feature.lat],
              zoom: Math.min(current.zoom + 2, 16),
            });
          }
          : () => {
            pinClickRef.current = true;
            if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
            const opened = pinnedRef.current === feature.key ? null : feature.key;
            pinnedRef.current = opened;
            setPinnedKey(opened);
            setHoverKey(opened);
          },
        onEnter: feature.kind === "pin" ? () => holdRef.current(feature.key) : undefined,
        onLeave: feature.kind === "pin" ? () => releaseRef.current() : undefined,
      });
      markersRef.current.set(feature.key, { marker, element });
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
    if (youRef.current) {
      youRef.current.remove();
      youRef.current = null;
    }
    if (user) {
      const element = document.createElement("div");
      element.className = "catalog-map__you";
      element.setAttribute("aria-hidden", "true");
      const marker = map.addMarker({
        coordinates: [user.lng, user.lat],
        element,
        zIndex: 500,
        shape: [[-8, -8], [8, 8]],
      });
      youRef.current = marker;
      map.setLocation({ center: [user.lng, user.lat], zoom: 14 });
    }
  }, [userKey, ready, user]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const next = focusRef.current ?? MINSK_POINT;
    const center = map.center;
    const zoom = openingZoom();
    const same = Math.abs(center[1] - next.lat) < 0.0001
      && Math.abs(center[0] - next.lng) < 0.0001
      && Math.round(map.zoom) === zoom;
    if (same) return;
    map.setLocation({ center: [next.lng, next.lat], zoom });
  }, [ready, focusKey]);

  useEffect(() => {
    const lit = litPinKeys(featuresRef.current, openKey, highlightKeys);
    const dim = lit.size > 0;
    for (const [key, item] of markersRef.current) {
      const glyph = item.element.querySelector(".catalog-map__glyph");
      if (glyph) {
        const mode = lit.has(key) ? "lit" : dim ? "dim" : "idle";
        glyph.classList.remove("is-idle", "is-lit", "is-dim");
        glyph.classList.add(`is-${mode}`);
      }
      item.marker.update({ zIndex: lit.has(key) ? 600 : item.element.dataset.kind === "cluster" ? 40 : 0 });
    }
  }, [openKey, highlightKeys, featureKey]);

  useEffect(() => {
    const feature = featuresRef.current.find((entry) => entry.key === openKey);
    onPinHoverRef.current?.(feature?.kind === "pin" ? feature.key : null);
  }, [openKey, featureKey]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    const node = nodeRef.current;
    const placed = active ? markersRef.current.get(active.key) : null;
    if (!map || !node || !active || !placed) {
      setCardStyle(null);
      return;
    }
    const place = () => {
      const tip = tipRef.current;
      const pin = markersRef.current.get(active.key)?.element;
      if (!tip || !pin) return;
      const mapBox = node.getBoundingClientRect();
      const pinBox = pin.getBoundingClientRect();
      const x = pinBox.left - mapBox.left + PIN_ANCHOR_X;
      const y = pinBox.top - mapBox.top + PIN_ANCHOR_Y;
      tip.style.width = `${Math.min(248, Math.max(160, node.clientWidth - TIP_EDGE * 2))}px`;
      const people = tip.querySelector<HTMLElement>(".catalog-map__people");
      const locked = people?.style.maxHeight ?? "";
      if (people) people.style.maxHeight = "none";
      const naturalHeight = tip.offsetHeight;
      const peopleHeight = people?.offsetHeight ?? 0;
      const peopleScroll = people?.scrollHeight ?? peopleHeight;
      if (people) people.style.maxHeight = locked;
      const next = tipPlacement({
        x,
        y,
        mapWidth: node.clientWidth,
        mapHeight: node.clientHeight,
        naturalHeight,
        peopleHeight,
        peopleScroll,
      });
      setTipBelow(next.below);
      setCardStyle((current) => {
        const style: TipStyle = {
          position: "absolute",
          left: next.left,
          top: y,
          right: "auto",
          bottom: "auto",
          width: next.width,
          transform: next.transform,
          "--people-max": `${Math.round(next.peopleMax)}px`,
        };
        if (
          current
          && current.left === style.left
          && current.top === style.top
          && current.width === style.width
          && current.transform === style.transform
          && current["--people-max"] === style["--people-max"]
        ) return current;
        return style;
      });
    };
    place();
    moveListeners.current.add(place);
    return () => {
      moveListeners.current.delete(place);
    };
  }, [active]);

  return (
    <>
      <div ref={nodeRef} className="catalog-map__map" />
      {active ? (
        <div
          ref={tipRef}
          className={`catalog-map__tip${tipBelow ? " is-below" : " is-above"}`}
          style={cardStyle ?? { position: "absolute", visibility: "hidden" }}
          onMouseEnter={() => holdPin(active.key)}
          onMouseLeave={releasePin}
        >
          <ul className="catalog-map__people">
            {active.trainers.slice(0, MAP_TOOLTIP_CAP).map((trainer) => (
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
          {active.count > Math.min(active.trainers.length, MAP_TOOLTIP_CAP) ? (
            <p className="catalog-map__more">Ещё {active.count - Math.min(active.trainers.length, MAP_TOOLTIP_CAP)} в списке рядом</p>
          ) : null}
          {pinnedKey === active.key ? (
            <button
              type="button"
              className="catalog-map__close"
              aria-label="Закрыть"
              onClick={dismissTip}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      <style>{MAP_VIEW_CSS}</style>
    </>
  );
}

const MAP_VIEW_CSS = `
.catalog-map__map { width: 100%; height: 100%; background: var(--neutral-bg); overflow-anchor: none; }
.catalog-map__pin, .catalog-map__cluster { margin: 0; padding: 0; background: none; border: 0; cursor: pointer; }
.catalog-map__pin { width: 36px; height: 36px; transform: translate(-18px, -34px); animation: map-mark-in 0.28s ease; }
.catalog-map__cluster { transform: translate(-50%, -50%); }
.catalog-map__bubble {
  display: grid; place-items: center; border-radius: 999px; background: var(--primary); color: #fff;
  border: 2px solid #fff; box-shadow: 0 8px 18px rgba(var(--primary-rgb), 0.35);
  font-size: 13px; font-weight: var(--fw-title); line-height: 1; animation: map-mark-in 0.28s ease;
}
@keyframes map-mark-in { from { opacity: 0; } to { opacity: 1; } }
.catalog-map__glyph { position: relative; display: block; width: 36px; height: 36px; color: #f04b50; color: var(--primary, #f04b50); transform-origin: 50% 100%; transition: transform 0.16s ease, opacity 0.16s ease, filter 0.16s ease, color 0.16s ease; }
.catalog-map__glyph.is-lit { color: #f04b50; color: var(--primary, #f04b50); transform: translateY(-4px) scale(1.14); filter: drop-shadow(0 8px 10px rgba(240, 75, 80, 0.5)); }
.catalog-map__glyph.is-dim { color: #c5c9d1; opacity: 1; }
.catalog-map__count {
  position: absolute; top: -2px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 999px; background: var(--dark); color: #fff; font-size: 11px; font-weight: var(--fw-title);
  line-height: 18px; text-align: center;
}
.catalog-map__you {
  width: 16px; height: 16px; box-sizing: border-box; border-radius: 999px;
  background: #f04b50; border: 3px solid #fff; transform: translate(-50%, -50%);
  box-shadow: 0 0 0 6px rgba(240, 75, 80, 0.2);
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
  position: absolute; top: 4px; right: 4px; z-index: 2; width: 44px; height: 44px;
  border: 0; border-radius: 999px; background: var(--light-bg); color: var(--dark);
  font-size: 22px; line-height: 1; cursor: pointer;
}
.catalog-map__close:hover { color: var(--primary); }
.catalog-map__people { position: relative; z-index: 1; list-style: none; margin: 0; padding: 8px 0 0; display: grid; gap: 4px; min-height: 0; max-height: var(--people-max, min(320px, 46dvh)); overflow: auto; overscroll-behavior: contain; }
.catalog-map__people a {
  display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; min-height: 44px;
  padding: 4px; border-radius: 12px; color: inherit; text-decoration: none;
}
.catalog-map__people a:hover { background: rgba(var(--primary-rgb), 0.08); }
.catalog-map__photo { width: 48px; height: 64px; object-fit: cover; object-position: center; border-radius: 10px; display: block; background: var(--light-bg); }
.catalog-map__photo--empty { display: grid; place-items: center; color: var(--primary); font-weight: var(--fw-title); font-size: 18px; }
.catalog-map__copy { min-width: 0; display: grid; gap: 1px; align-content: start; }
.catalog-map__tip:has(.catalog-map__close) .catalog-map__people > li:first-child .catalog-map__copy { padding-right: 48px; }
.catalog-map__copy .trainer-name {
  flex-direction: column; align-items: flex-start; gap: 0;
  font-size: 13px; line-height: 1.15; letter-spacing: 0; font-weight: var(--fw-title);
}
.catalog-map__copy .trainer-name__line { overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: break-word; }
.catalog-map__sport { color: var(--muted); font-size: 12px; line-height: 1.3; }
.catalog-map__where, .catalog-map__more { margin: 0; padding: 0 6px 2px; color: var(--muted); font-size: 12px; line-height: 1.3; }
.catalog-map__price { font-size: 13px; font-weight: var(--fw-title); color: var(--dark); }
`;
