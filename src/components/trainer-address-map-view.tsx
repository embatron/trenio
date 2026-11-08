import { useEffect, useRef } from "react";

import { loadYandexMaps, mountYandexMap, quietMapChrome, type YandexMap } from "@/lib/maps/yandex-maps";

const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" fill="#f04b50" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>`;

export type TrainerMapPoint = { lat: number; lng: number; label: string };

export function TrainerAddressMapView({
  points,
  activeLat,
  activeLng,
  onUnavailable,
}: {
  points: TrainerMapPoint[];
  activeLat: number;
  activeLng: number;
  onUnavailable?: () => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const activeRef = useRef({ lat: activeLat, lng: activeLng });
  const onUnavailableRef = useRef(onUnavailable);
  activeRef.current = { lat: activeLat, lng: activeLng };
  onUnavailableRef.current = onUnavailable;
  const key = points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|");

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || points.length === 0) return;
    let cancelled = false;
    let map: YandexMap | null = null;
    const fail = () => {
      if (!cancelled) onUnavailableRef.current?.();
    };
    void loadYandexMaps()
      .then(async (ymaps) => {
        if (cancelled) return;
        const here = activeRef.current;
        map = mountYandexMap(ymaps, node, [here.lng, here.lat], 16);
        mapRef.current = map;
        for (const point of points) {
          const element = document.createElement("div");
          element.className = "trainer-address__pin";
          element.innerHTML = PIN;
          element.title = point.label;
          element.setAttribute("role", "img");
          element.setAttribute("aria-label", point.label);
          map.addMarker({
            coordinates: [point.lng, point.lat],
            element,
            shape: [[-18, -34], [18, 2]],
          });
        }
        if (cancelled) return;
        quietMapChrome(node);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      map?.destroy();
      mapRef.current = null;
    };
    // The point key is the stable identity. The active view is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    mapRef.current?.setLocation({ center: [activeLng, activeLat], zoom: 16 });
  }, [activeLat, activeLng]);

  return <div ref={nodeRef} className="trainer-address__map" />;
}
