import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { CatalogSearchForm } from "@/components/catalog-search-form";
import { CatalogTrainerCard } from "@/components/catalog-trainer-card";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SportIcon } from "@/components/sport-icon";
import { TrainerCatalogMap } from "@/components/trainer-catalog-map";
import type { CatalogMapBounds, CatalogMapPin, CatalogMapUser } from "@/components/trainer-catalog-map-view";
import {
  CATALOG_ORIGIN,
  catalogSportById,
  catalogSportsFromQuery,
  trainerMatchesSportSelection,
  type CatalogSport,
} from "@/lib/catalog/catalog-sports";
import { listMapTrainersFn, type MapTrainer } from "@/lib/catalog/map-trainers";
import { TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";
import { detectVisitorPointFn, resolveVisitorPointFn } from "@/lib/catalog/visitor-place";
import { distanceKm } from "@/lib/geo/distance";
import { countRu, pluralRu } from "@/lib/ru-plural";

const MINSK: CatalogMapUser = { lat: 53.9006, lng: 27.559 };

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>) => ({
    sports: typeof search.sports === "string" ? search.sports : undefined,
  }),
  head: ({ match }) => {
    const sports = parentSports(match.search.sports);
    const title = "Тренеры на карте | trenio.by";
    const description = "Карта мест тренировок в Беларуси. Направления сверху, тренеры рядом с картой.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(sports.length > 0 ? [{ name: "robots" as const, content: "noindex,follow" }] : []),
      ],
      links: [{ rel: "canonical", href: `${CATALOG_ORIGIN}/map` }],
    };
  },
  loader: async () => {
    const [trainers, point] = await Promise.all([
      listMapTrainersFn(),
      resolveVisitorPointFn(),
    ]);
    return { trainers, point };
  },
  component: MapPage,
});

function inBelarus(lat: number, lng: number) {
  return lat >= 51.2 && lat <= 56.2 && lng >= 23.1 && lng <= 32.8;
}

function visitorFocus(lat: number | null, lng: number | null): CatalogMapUser {
  if (lat == null || lng == null || !inBelarus(lat, lng)) return MINSK;
  return { lat, lng };
}

function placeInView(lat: number, lng: number, bounds: CatalogMapBounds | null) {
  if (!bounds) return true;
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

/** Level-1 categories only. A child id from another page becomes its parent. */
function parentSports(value: string | undefined): CatalogSport[] {
  const sports: CatalogSport[] = [];
  for (const sport of catalogSportsFromQuery(value)) {
    const parent = sport.level === 1 ? sport : catalogSportById(sport.parentSlug);
    if (!parent || sports.some((item) => item.id === parent.id)) continue;
    sports.push(parent);
  }
  return sports;
}

function cardCity(trainer: MapTrainer) {
  const cities = [...new Set(trainer.places.map((place) => place.city.trim()).filter(Boolean))];
  return cities.join(", ") || trainer.city;
}

function pinsFor(trainers: MapTrainer[]): CatalogMapPin[] {
  const groups = new Map<string, CatalogMapPin>();
  for (const trainer of trainers) {
    for (const place of trainer.places) {
      const key = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
      const card = {
        slug: trainer.slug,
        firstName: trainer.firstName,
        lastName: trainer.lastName,
        name: trainer.name,
        photo: trainer.photo,
        tags: trainer.tags,
        rating: trainer.rating,
        reviews: trainer.reviews,
        price: trainer.price,
      };
      const existing = groups.get(key);
      if (existing) {
        if (!existing.trainers.some((item) => item.slug === trainer.slug)) existing.trainers.push(card);
        continue;
      }
      groups.set(key, {
        key,
        lat: place.lat,
        lng: place.lng,
        label: [place.city, place.address].map((part) => part.trim()).filter(Boolean).join(", "),
        trainers: [card],
      });
    }
  }
  return [...groups.values()];
}

function MapPage() {
  const { trainers, point } = Route.useLoaderData();
  const { sports: sportsQuery } = Route.useSearch();
  const navigate = useNavigate();
  const selectedSports = useMemo(() => parentSports(sportsQuery), [sportsQuery]);
  const [userPoint, setUserPoint] = useState<CatalogMapUser | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);
  const [bounds, setBounds] = useState<CatalogMapBounds | null>(null);
  const [origin, setOrigin] = useState<CatalogMapUser>(() => visitorFocus(point.lat, point.lng));

  useEffect(() => {
    if (!point.lookupOnClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json", {
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { ip?: unknown };
        if (typeof data.ip !== "string" || !data.ip) return;
        const detected = await detectVisitorPointFn({ data: { ip: data.ip } });
        if (cancelled) return;
        setOrigin(visitorFocus(detected.lat, detected.lng));
      } catch {
        setOrigin(MINSK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [point.lookupOnClient]);

  const toggleCategory = (slug: string) => {
    const next = selectedSports.some((sport) => sport.id === slug)
      ? selectedSports.filter((sport) => sport.id !== slug)
      : [...selectedSports, catalogSportById(slug)].filter((sport): sport is CatalogSport => sport != null);
    const sports = next.map((sport) => sport.id).join(",");
    void navigate({ to: "/map", search: { sports: sports || undefined }, replace: true });
  };

  const filtered = useMemo(
    () => trainers.filter((trainer) => trainerMatchesSportSelection(trainer, selectedSports, "")),
    [trainers, selectedSports],
  );
  const pins = useMemo(() => pinsFor(filtered), [filtered]);

  const listed = useMemo(() => {
    const rows = filtered.filter((trainer) => trainer.places.some((place) => placeInView(place.lat, place.lng, bounds)));
    const nearest = (trainer: MapTrainer) => {
      let best = Number.POSITIVE_INFINITY;
      for (const place of trainer.places) {
        if (!placeInView(place.lat, place.lng, bounds)) continue;
        const km = distanceKm(origin, place);
        if (km < best) best = km;
      }
      return best;
    };
    return [...rows].sort((a, b) => nearest(a) - nearest(b) || a.name.localeCompare(b.name, "ru"));
  }, [filtered, bounds, origin]);

  const addressCount = useMemo(
    () => listed.reduce((sum, trainer) => (
      sum + trainer.places.filter((place) => placeInView(place.lat, place.lng, bounds)).length
    ), 0),
    [listed, bounds],
  );

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateNote("Браузер не сообщает местоположение. Карта остаётся на Минске.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!inBelarus(lat, lng)) {
          setUserPoint(null);
          setLocateNote("Точка вне Беларуси. Карта остаётся на Минске.");
          return;
        }
        setUserPoint({ lat, lng });
        setLocateNote(null);
      },
      () => {
        setLocating(false);
        setLocateNote("Браузер не передал координаты. Карта остаётся на Минске.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const headerSport = selectedSports.length === 1 ? selectedSports[0].label : "";

  return (
    <div className="page-shell map-page">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <SiteHeader
        middleSlot={(
          <CatalogSearchForm
            key={selectedSports.map((sport) => sport.id).join("|")}
            variant="header"
            sport={headerSport}
          />
        )}
      />
      <main>
        <section className="map-hero">
          <div className="layout-container">
            <nav className="map-crumbs" aria-label="Хлебные крошки">
              <Link to="/" activeOptions={{ exact: true }}>Главная</Link>
              <span aria-hidden="true">/</span>
              <span className="is-current" aria-current="page">Карта</span>
            </nav>
            <h1>Тренеры на карте</h1>
            <p>Нажмите на метку — откроется короткая карточка. Если место не определилось, карта открыта на Минске.</p>
          </div>
        </section>
        <div className="layout-rail map-tax">
          <div className="layout-rail__track" role="toolbar" aria-label="Направления">
            {TOP_LEVEL_SPORT_CATEGORIES.map((category) => {
              const active = selectedSports.some((sport) => sport.id === category.slug);
              return (
                <button
                  key={category.slug}
                  type="button"
                  className={`map-tax__btn${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleCategory(category.slug)}
                >
                  <SportIcon iconKey={category.iconKey} width={24} height={24} />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>
        <section className="map-board">
          <div className="layout-container">
            {locateNote ? <p className="map-note">{locateNote}</p> : null}
            <div className="map-stage">
              <div className="map-stage__map">
                <TrainerCatalogMap
                  pins={pins}
                  user={userPoint}
                  focus={origin}
                  located={userPoint != null}
                  locating={locating}
                  onLocate={locate}
                  onBounds={setBounds}
                  empty={(
                    <div>
                      <p>{trainers.length === 0 ? "На карте пока нет мест с координатами." : "В этом направлении на карте никого нет."}</p>
                    </div>
                  )}
                />
              </div>
              <div className="map-stage__list">
                <div className="map-count">
                  <b>{listed.length}</b> {pluralRu(listed.length, "тренер", "тренера", "тренеров")}
                  {" · "}
                  {countRu(addressCount, "адрес", "адреса", "адресов")}
                  {" · сначала ближайшие"}
                </div>
                {listed.length === 0 ? (
                  <div className="cat-empty">
                    <h3>
                      {trainers.length === 0
                        ? "На карте пока нет мест с координатами"
                        : filtered.length === 0
                          ? "В этом направлении никого нет"
                          : "В этой области карты никого нет"}
                    </h3>
                    {filtered.length > 0 ? <p>Отдалите карту — тренеры за краем вернутся в список.</p> : null}
                  </div>
                ) : (
                  <div className="map-people">
                    {listed.map((trainer) => (
                      <CatalogTrainerCard
                        key={trainer.slug}
                        trainer={{
                          slug: trainer.slug,
                          name: trainer.name,
                          firstName: trainer.firstName,
                          lastName: trainer.lastName,
                          photo: trainer.photo,
                          tags: trainer.tags,
                          desc: "",
                          rating: trainer.rating,
                          reviews: trainer.reviews,
                          city: cardCity(trainer),
                          price: trainer.price,
                          experience: trainer.experience,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const PAGE_CSS = `
.map-page { background: var(--white); }
.map-hero { padding-top: 12px; }
.map-hero .layout-container { display: grid; gap: 8px; }
.map-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 13px; line-height: 1.3; font-weight: var(--fw-title); color: var(--muted); }
.map-crumbs a { color: var(--muted); text-decoration: none; }
.map-crumbs a:hover { color: var(--primary); }
.map-hero h1 { margin: 0; font-size: var(--fs-page); line-height: 1.15; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.map-hero p { margin: 0; font-size: var(--fs-meta); line-height: 1.45; color: var(--muted); max-width: 68ch; }
.map-tax { margin-top: 16px; }
.map-tax .layout-rail__track { gap: 8px; }
.map-tax__btn { flex: 0 0 auto; min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid transparent; border-radius: 999px; background: var(--light-bg); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.map-tax__btn svg { width: 24px; height: 24px; flex: 0 0 auto; }
.map-tax__btn:hover { background: rgba(var(--primary-rgb), 0.08); }
.map-tax__btn.is-active { background: var(--primary); color: #fff; }
.map-board { padding-top: 16px; padding-bottom: 28px; }
.map-board .layout-container { display: grid; gap: 12px; }
.map-note { margin: 0; font-size: 13px; line-height: 1.4; color: var(--muted); }
.map-stage { display: grid; gap: var(--layout-gap); align-items: start; }
.map-stage__map, .map-stage__list { min-width: 0; }
.map-count { margin: 0 0 12px; font-size: 15px; color: var(--muted); font-weight: var(--fw-ui); }
.map-count b { color: var(--dark); font-weight: var(--fw-title); }
.map-people { display: grid; grid-template-columns: 1fr; gap: var(--layout-gap); }
.cat-empty { padding: 28px 16px; text-align: center; border-radius: var(--card-radius); border: 1px solid rgba(var(--primary-rgb), 0.16); background: rgba(var(--primary-rgb), 0.04); display: grid; gap: 8px; justify-items: center; }
.cat-empty h3 { margin: 0; font-size: 20px; font-weight: var(--fw-heading); color: var(--dark); }
.cat-empty p { margin: 0; color: var(--muted); font-size: 14px; }
@media (min-width: 640px) {
  .map-people { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 960px) {
  .map-stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .map-stage__map { position: sticky; top: 12px; }
}
`;
