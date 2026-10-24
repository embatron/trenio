import { useEffect, useRef } from "react";
import { divIcon, map as createMap, marker, type Map as LeafletMap, tileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";

const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" fill="#f04b50" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>`;

export type TrainerMapPoint = { lat: number; lng: number; label: string };

export function TrainerAddressMapView({
  points,
  activeLat,
  activeLng,
}: {
  points: TrainerMapPoint[];
  activeLat: number;
  activeLng: number;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const key = points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|");

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || points.length === 0) return;
    const map = createMap(node, {
      scrollWheelZoom: false,
      attributionControl: false,
      zoomControl: true,
    }).setView([activeLat, activeLng], 16);
    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "",
      maxZoom: 19,
    }).addTo(map);
    const icon = divIcon({
      className: "trainer-address__pin",
      html: PIN,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });
    for (const point of points) {
      marker([point.lat, point.lng], { icon, title: point.label, alt: point.label, keyboard: true }).addTo(map);
    }
    mapRef.current = map;
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
    };
    // The point key is the stable identity. Active view is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    mapRef.current?.setView([activeLat, activeLng], 16);
  }, [activeLat, activeLng]);

  return <div ref={nodeRef} className="trainer-address__leaflet" />;
}
