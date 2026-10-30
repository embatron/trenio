import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { CatalogSearchForm } from "@/components/catalog-search-form";
import { CatalogTrainerCard } from "@/components/catalog-trainer-card";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SportIcon } from "@/components/sport-icon";
import { TrainerCatalogMap } from "@/components/trainer-catalog-map";
import type { CatalogMapBounds, CatalogMapUser } from "@/components/trainer-catalog-map-view";
import {
  catalogSportById,
  catalogSportByName,
  catalogSportsFromQuery,
  filterCatalogSports,
  type CatalogSport,
} from "@/lib/catalog/catalog-sports";
import { cityCatalogByName, cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { resolveBelarusCity } from "@/lib/catalog/city-taxonomy";
import { MAP_CRUMB, mapPageHead } from "@/lib/seo/pages";
import { TRAINER_FORMAT_OPTIONS } from "@/lib/catalog/published-trainers";
import { listMapAreaFn, type MapAreaFeature, type MapTrainer } from "@/lib/catalog/map-trainers";
import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";
import { TRAINER_INVITE_LINE } from "@/lib/catalog/trainer-welcome";
import { resolveVisitorPointFn, type VisitorPoint } from "@/lib/catalog/visitor-place";
import { reportClientEvent } from "@/lib/log/client-reporter";
import { pluralRu } from "@/lib/ru-plural";

const MINSK: CatalogMapUser = { lat: 53.9006, lng: 27.559 };

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>) => ({
    sports: typeof search.sports === "string" ? search.sports : undefined,
    city: typeof search.city === "string" ? search.city : undefined,
  }),
  head: ({ match }) => {
    const sports = selectedMapSports(match.search.sports);
    const city = cityCatalogBySlug(match.search.city ?? "");
    return mapPageHead(sports.length > 0 || Boolean(city));
  },
  loader: async () => ({ point: await resolveVisitorPointFn() }),
  component: MapRoute,
});

function inBelarus(lat: number, lng: number) {
  return lat >= 51.2 && lat <= 56.2 && lng >= 23.1 && lng <= 32.8;
}

function visitorFocus(lat: number | null, lng: number | null): CatalogMapUser {
  if (lat == null || lng == null || !inBelarus(lat, lng)) return MINSK;
  return { lat, lng };
}

function selectedMapSports(value: string | undefined) {
  return catalogSportsFromQuery(value, 24);
}

function sportsFromSearchText(value: string): { sports: CatalogSport[]; unmatched: boolean } {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { sports: [], unmatched: false };
  const sports: CatalogSport[] = [];
  for (const part of parts) {
    const sport = catalogSportByName(part);
    if (!sport) return { sports: [], unmatched: true };
    if (!sports.some((item) => item.id === sport.id)) sports.push(sport);
  }
  return { sports, unmatched: false };
}

function childCatalogSport(parentSlug: string, childSlug: string): CatalogSport | null {
  const direct = catalogSportById(childSlug);
  if (direct?.level === 2 && direct.parentSlug === parentSlug) return direct;
  return catalogSportById(`${parentSlug}/${childSlug}`);
}

const EXPERIENCE_OPTIONS = [
  { years: 1, label: "от 1 года" },
  { years: 3, label: "от 3 лет" },
  { years: 5, label: "от 5 лет" },
  { years: 10, label: "от 10 лет" },
] as const;

function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function cardCity(trainer: MapTrainer) {
  const cities = [...new Set(trainer.places.map((place) => place.city.trim()).filter(Boolean))];
  return cities.join(", ") || trainer.city;
}

function frameKey(frame: CatalogMapBounds) {
  const round = (value: number) => value.toFixed(3);
  return `${round(frame.south)},${round(frame.west)},${round(frame.north)},${round(frame.east)},${Math.round(frame.zoom)}`;
}

function pinKeyFor(lat: number, lng: number) {
  return `p:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function MapRoute() {
  const { point } = Route.useLoaderData();
  const { sports, city } = Route.useSearch();
  return <CatalogMapScreen mode="map" sportsQuery={sports} citySlug={city} visitor={point} />;
}

export function CatalogMapScreen({
  mode,
  sportsQuery,
  citySlug,
  sportText = "",
  locationText = "",
  audience: audienceQuery = null,
  format: formatQuery = null,
  visitor,
}: {
  mode: "map" | "search";
  sportsQuery?: string;
  citySlug?: string;
  sportText?: string;
  locationText?: string;
  audience?: "adult" | "child" | null;
  format?: "individual" | "group" | null;
  visitor: VisitorPoint;
}) {
  const navigate = useNavigate();
  const searchKey = mode === "map"
    ? `map:${sportsQuery ?? ""}:${citySlug ?? ""}`
    : `search:${sportText}:${locationText}:${audienceQuery ?? ""}:${formatQuery ?? ""}`;
  const fromUrl = useMemo(
    () => (mode === "map" ? { sports: selectedMapSports(sportsQuery), unmatched: false } : sportsFromSearchText(sportText)),
    [mode, sportsQuery, sportText],
  );
  const [sportOverride, setSportOverride] = useState<{ key: string; sports: CatalogSport[] } | null>(null);
  const selectedSports = sportOverride?.key === searchKey ? sportOverride.sports : fromUrl.sports;
  const unmatchedSport = mode === "search" && sportOverride?.key !== searchKey && fromUrl.unmatched;
  const resolvedCity = mode === "search" ? resolveBelarusCity(locationText) : null;
  const cityPage = mode === "map"
    ? (citySlug ? cityCatalogBySlug(citySlug) : null)
    : cityCatalogByName(resolvedCity ?? locationText);
  const cityName = mode === "map" ? (cityPage?.name ?? "") : (resolvedCity ?? locationText.trim());
  const point = visitor;
  const cityPoint: CatalogMapUser | null = cityPage ? { lat: cityPage.lat, lng: cityPage.lng } : null;
  const openingFocus = cityPoint ?? visitorFocus(point.lat, point.lng);
  const [userPoint, setUserPoint] = useState<CatalogMapUser | null>(null);
  const [locating, setLocating] = useState(false);
  const [frame, setFrame] = useState<CatalogMapBounds | null>(null);
  const [features, setFeatures] = useState<MapAreaFeature[]>([]);
  const [rows, setRows] = useState<MapTrainer[]>([]);
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [areaReady, setAreaReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [priceSpan, setPriceSpan] = useState({ min: 0, max: 100 });
  const [cardSlug, setCardSlug] = useState<string | null>(null);
  const [pinSlugs, setPinSlugs] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sportQuery, setSportQuery] = useState("");
  const [audience, setAudience] = useState<"self" | "child" | null>(mode === "search" ? (audienceQuery === "child" ? "child" : "self") : null);
  const [formats, setFormats] = useState<Array<"individual" | "group">>(mode === "search" && formatQuery ? [formatQuery] : []);
  const [minExperience, setMinExperience] = useState<number | null>(null);
  const [price, setPrice] = useState<{ min: number; max: number } | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<Parameters<typeof listMapAreaFn>[0]["data"] | null>(null);
  const generationRef = useRef(0);
  const nextCursorRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  nextCursorRef.current = nextCursor;
  loadingRef.current = loading;

  const onFrame = (next: CatalogMapBounds) => {
    setFrame((current) => (current && frameKey(current) === frameKey(next) ? current : next));
  };

  const onPinHover = (key: string | null) => {
    if (!key) {
      setPinSlugs((current) => (current.length === 0 ? current : []));
      return;
    }
    const pin = features.find((feature) => feature.kind === "pin" && feature.key === key);
    const fromPin = pin?.kind === "pin" ? pin.slugs : [];
    const fromRows = rows.flatMap((trainer) => (
      trainer.places.some((place) => pinKeyFor(place.lat, place.lng) === key) ? [trainer.slug] : []
    ));
    const slugs = [...new Set([...fromPin, ...fromRows])];
    setPinSlugs((current) => (
      current.length === slugs.length && current.every((slug, index) => slug === slugs[index]) ? current : slugs
    ));
  };

  const applySports = (next: CatalogSport[]) => {
    if (mode === "search") {
      setSportOverride({ key: searchKey, sports: next.slice(0, 24) });
      return;
    }
    const sports = next.slice(0, 24).map((sport) => sport.id).join(",");
    void navigate({
      to: "/map",
      search: { sports: sports || undefined, city: cityPage?.slug },
      replace: true,
    });
  };

  const toggleSport = (sport: CatalogSport) => {
    const selected = selectedSports.some((item) => item.id === sport.id);
    if (selected) {
      applySports(selectedSports.filter((item) => item.id !== sport.id));
      return;
    }
    const withoutFamily = selectedSports.filter((item) => (
      sport.level === 1
        ? item.parentSlug !== sport.slug || item.level === 1
        : item.id !== sport.parentSlug
    ));
    applySports([...withoutFamily, sport]);
  };

  const priceBounds = priceSpan;
  const priceMin = Math.min(Math.max(price?.min ?? priceBounds.min, priceBounds.min), priceBounds.max - 1);
  const priceMax = Math.max(Math.min(price?.max ?? priceBounds.max, priceBounds.max), priceMin + 1);
  const extraActive = (audience != null ? 1 : 0)
    + (formats.length > 0 ? 1 : 0)
    + (minExperience != null ? 1 : 0)
    + (price != null ? 1 : 0);
  const filterCount = selectedSports.length + extraActive + (unmatchedSport ? 1 : 0);
  const appliedFilters = [
    ...selectedSports.map((sport) => ({ key: `sport:${sport.id}`, label: sport.label })),
    ...(unmatchedSport && sportText.trim() ? [{ key: "sport:unmatched", label: sportText.trim() }] : []),
    ...(audience === "self" ? [{ key: "audience", label: "для себя" }] : []),
    ...(audience === "child" ? [{ key: "audience", label: "для ребёнка" }] : []),
    ...formats.flatMap((id) => {
      const label = TRAINER_FORMAT_OPTIONS.find((option) => option.id === id)?.label;
      return label ? [{ key: `format:${id}`, label }] : [];
    }),
    ...(minExperience == null ? [] : EXPERIENCE_OPTIONS.flatMap((option) => (
      option.years === minExperience ? [{ key: `exp:${option.years}`, label: option.label }] : []
    ))),
    ...(price != null ? [{ key: "price", label: `от ${priceMin} до ${priceMax} BYN` }] : []),
  ];
  const removeApplied = (key: string) => {
    if (key === "sport:unmatched") {
      applySports([]);
      return;
    }
    if (key.startsWith("sport:")) {
      const id = key.slice("sport:".length);
      applySports(selectedSports.filter((sport) => sport.id !== id));
      return;
    }
    if (key === "audience") setAudience(null);
    if (key === "price") setPrice(null);
    if (key.startsWith("exp:")) setMinExperience(null);
    if (key.startsWith("format:")) {
      const id = key.slice("format:".length);
      setFormats((current) => current.filter((item) => item !== id));
    }
  };
  const sportKey = unmatchedSport ? "__none__" : selectedSports.map((sport) => sport.id).join(",");
  const filterKey = [
    sportKey,
    cityName,
    audience ?? "",
    formats.join(","),
    minExperience ?? "",
    price ? `${priceMin}:${priceMax}` : "",
  ].join("|");

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (mode !== "search") return;
    setSportOverride(null);
    setAudience(audienceQuery === "child" ? "child" : "self");
    setFormats(formatQuery ? [formatQuery] : []);
    setMinExperience(null);
    setPrice(null);
    setSportQuery("");
    setMoreOpen(false);
  }, [searchKey, mode, audienceQuery, formatQuery]);

  const resetFilters = () => {
    setAudience(null);
    setFormats([]);
    setMinExperience(null);
    setPrice(null);
    setSportQuery("");
    if (selectedSports.length > 0) applySports([]);
  };

  const pickSport = (sport: CatalogSport) => {
    if (!selectedSports.some((item) => item.id === sport.id)) toggleSport(sport);
    setSportQuery("");
  };
  const emptyTitle = mode === "search" && matched === 0
    ? "Ничего не нашлось"
    : matched === 0
    ? extraActive > 0
      ? "По этим фильтрам никого нет"
      : cityPage && selectedSports.length > 0
        ? `В ${cityPage.locative} в этом направлении никого нет`
        : cityPage
          ? `В ${cityPage.locative} никого нет`
          : selectedSports.length > 0
            ? "В этом направлении никого нет"
            : "На карте пока нет мест с координатами"
    : "В этой области карты никого нет";
  const firstInSection = matched === 0 && (
    mode === "search" || selectedSports.length > 0 || extraActive > 0
  );

  useEffect(() => {
    if (!frame) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    loadingRef.current = true;
    setLoading(true);
    const payload = {
      south: frame.south,
      west: frame.west,
      north: frame.north,
      east: frame.east,
      zoom: frame.zoom,
      sports: sportKey ? sportKey.split(",") : [],
      city: cityName,
      audience,
      formats,
      minExperience,
      priceMin: price ? priceMin : null,
      priceMax: price ? priceMax : null,
      cursor: 0,
      includeFeatures: true,
    };
    const timer = window.setTimeout(() => {
      void listMapAreaFn({ data: payload })
        .then((area) => {
          if (generationRef.current !== generation) return;
          queryRef.current = payload;
          setFeatures(area.features);
          setRows(area.trainers);
          setTotal(area.total);
          setMatched(area.matched);
          setNextCursor(area.nextCursor);
          setPriceSpan((current) => (
            current.min === area.priceMin && current.max === area.priceMax
              ? current
              : { min: area.priceMin, max: area.priceMax }
          ));
          setLoadError(false);
          setAreaReady(true);
        })
        .catch(() => {
          if (generationRef.current !== generation) return;
          setLoadError(true);
          setAreaReady(true);
        })
        .finally(() => {
          if (generationRef.current === generation) setLoading(false);
        });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      if (generationRef.current === generation) loadingRef.current = false;
    };
  }, [frame, filterKey]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      const cursor = nextCursorRef.current;
      const payload = queryRef.current;
      if (cursor == null || !payload || loadingRef.current || loadingMoreRef.current) return;
      const generation = generationRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      void listMapAreaFn({ data: { ...payload, cursor, includeFeatures: false } })
        .then((area) => {
          if (generationRef.current !== generation) return;
          setRows((current) => {
            const seen = new Set(current.map((trainer) => trainer.slug));
            return [...current, ...area.trainers.filter((trainer) => !seen.has(trainer.slug))];
          });
          setNextCursor(area.nextCursor);
        })
        .catch(() => {
          if (generationRef.current === generation) setLoadError(true);
        })
        .finally(() => {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
    }, { rootMargin: "280px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [areaReady, rows.length, nextCursor]);

  const highlightKeys = useMemo(() => {
    if (!cardSlug) return [];
    const trainer = rows.find((item) => item.slug === cardSlug);
    const fromRows = trainer?.places.map((place) => pinKeyFor(place.lat, place.lng)) ?? [];
    const fromPins = features.flatMap((feature) => (
      feature.kind === "pin" && feature.slugs.includes(cardSlug) ? [feature.key] : []
    ));
    return [...new Set([...fromRows, ...fromPins])];
  }, [cardSlug, rows, features]);

  const locate = () => {
    const note = (message: string) => {
      reportClientEvent({
        domain: "map",
        level: "warn",
        action: "map.locate",
        message,
        route: window.location.pathname,
      });
    };
    if (!navigator.geolocation) {
      note("Браузер не сообщает местоположение.");
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
          note("Точка вне Беларуси.");
          return;
        }
        setUserPoint({ lat, lng });
      },
      (error) => {
        setLocating(false);
        note(error.code === 1 ? "Браузер не разрешил местоположение." : "Браузер не передал координаты.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const headerSport = selectedSports.length === 1
    ? selectedSports[0].label
    : mode === "search" && selectedSports.length === 0
      ? sportText
      : "";
  const headerLocation = mode === "search" ? (cityName || cityPage?.name) : cityPage?.name;
  const queryLabel = [sportText, locationText].filter(Boolean).join(" · ");
  const sportHints = sportQuery.trim() ? filterCatalogSports(sportQuery, 8) : [];

  return (
    <div className="page-shell map-page">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <SiteHeader
        middleSlot={(
          <CatalogSearchForm
            key={`${mode}:${headerLocation ?? ""}:${headerSport}`}
            variant="header"
            sport={headerSport}
            location={headerLocation || undefined}
            audience={mode === "search" ? (audience === "child" ? "child" : "adult") : undefined}
          />
        )}
      />
      <main>
        <section className="map-hero">
          <div className="layout-container">
            <nav className="map-crumbs" aria-label="Хлебные крошки">
              <Link to="/" activeOptions={{ exact: true }}>Главная</Link>
              <span aria-hidden="true">/</span>
              <span className="is-current" aria-current="page">{mode === "search" ? "Поиск" : MAP_CRUMB}</span>
            </nav>
            <h1>
              {mode === "search"
                ? queryLabel
                  ? <>Результаты по запросу <em>«{queryLabel}»</em></>
                  : "Поиск тренера"
                : "Тренеры на карте"}
            </h1>
            <p>
              {mode === "search"
                ? "Карта и карточки по этому запросу. Наведите на метку — подсказка, на карточку — его метки. Если точек много, они собираются в группы."
                : cityPage
                ? `Места в ${cityPage.locative}. Наведите на метку — подсказка, на карточку — его метки. Если точек много, они собираются в группы.`
                : "Наведите на метку — подсказка со ссылкой. Наведите на карточку — подсветятся его метки. Если точек много, они собираются в группы. Карта сама не прокручивается."}
            </p>
            {mode === "search" ? (
              <div className="map-hero__search">
                <CatalogSearchForm
                  key={`hero:${headerLocation ?? ""}:${headerSport}:${audience ?? ""}:${formatQuery ?? ""}`}
                  variant="hero"
                  sport={headerSport}
                  location={headerLocation || undefined}
                  audience={audience === "child" ? "child" : "adult"}
                  format={formatQuery === "group" ? "group" : "individual"}
                />
              </div>
            ) : null}
          </div>
        </section>
        <div className="layout-container map-tax">
          <div className="map-more" ref={moreRef}>
            <div className="map-more__bar">
              <button
                type="button"
                className={`map-more__toggle${moreOpen ? " is-open" : ""}`}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                Фильтры
                {filterCount > 0 ? <span className="map-more__count">{filterCount}</span> : null}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {appliedFilters.length > 0 ? (
                <ul className="map-more__applied" aria-label="Отмеченные фильтры">
                  {appliedFilters.map((item) => (
                    <li key={item.key}>
                      <span>{item.label}</span>
                      <button type="button" aria-label={`Убрать ${item.label}`} onClick={() => removeApplied(item.key)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {moreOpen ? (
              <div className="map-more__panel">
                <div className="map-more__group">
                  <h2>Вид спорта</h2>
                  <div className="map-filter__search">
                    <input
                      type="text"
                      value={sportQuery}
                      placeholder="Название вида"
                      aria-label="Вид спорта"
                      autoComplete="off"
                      onChange={(event) => setSportQuery(event.target.value)}
                    />
                  </div>
                  {sportQuery.trim() ? (
                    <ul className="map-filter__suggest" aria-label="Подсказки видов спорта">
                      {sportHints.map((sport) => (
                        <li key={sport.id}>
                          <button type="button" onClick={() => pickSport(sport)}>
                            <span>{sport.label}</span>
                            {sport.level === 2 ? <small>{sport.parentLabel}</small> : null}
                          </button>
                        </li>
                      ))}
                      {sportHints.length === 0 ? <li className="map-filter__empty">Такого вида нет</li> : null}
                    </ul>
                  ) : null}
                  <div className="map-filter__directions" role="group" aria-label="Направления">
                    {listPublishedSportCategories().map((category) => {
                      const parent = catalogSportById(category.slug);
                      if (!parent) return null;
                      const parentOn = selectedSports.some((sport) => sport.id === parent.id);
                      return (
                        <button
                          key={category.slug}
                          type="button"
                          className={`map-tax__btn${parentOn ? " is-active" : ""}`}
                          aria-pressed={parentOn}
                          onClick={() => toggleSport(parent)}
                        >
                          {category.featuredImage ? (
                            <img src={category.featuredImage} alt="" width={20} height={20} />
                          ) : (
                            <SportIcon iconKey={category.iconKey} width={18} height={18} />
                          )}
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                  {listPublishedSportCategories().flatMap((category) => {
                    const opened = selectedSports.some((sport) => (
                      sport.level === 1 ? sport.slug === category.slug : sport.parentSlug === category.slug
                    ));
                    return opened && category.children.length > 0 ? [category] : [];
                  }).map((category, _index, openBranches) => (
                    <div key={category.slug} className="map-filter__branch">
                      {openBranches.length > 1 ? <h3>{category.label}</h3> : null}
                      <div className="map-filter__children">
                        {category.children.map((child) => {
                          const sport = childCatalogSport(category.slug, child.slug);
                          if (!sport) return null;
                          const active = selectedSports.some((item) => item.id === sport.id);
                          return (
                            <button
                              key={sport.id}
                              type="button"
                              className={`map-more__pill${active ? " is-active" : ""}`}
                              aria-pressed={active}
                              onClick={() => toggleSport(sport)}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="map-more__group">
                  <h2>Ищу тренера</h2>
                  <div className="map-more__opts">
                    {(
                      [
                        { v: "self" as const, l: "для себя" },
                        { v: "child" as const, l: "для ребёнка" },
                      ]
                    ).map((option) => (
                      <button
                        key={option.v}
                        type="button"
                        className={`map-more__pill${audience === option.v ? " is-active" : ""}`}
                        aria-pressed={audience === option.v}
                        onClick={() => setAudience((current) => (current === option.v ? null : option.v))}
                      >
                        {option.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="map-more__group">
                  <h2>Формат</h2>
                  <div className="map-more__opts">
                    {TRAINER_FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`map-more__pill${formats.includes(option.id) ? " is-active" : ""}`}
                        aria-pressed={formats.includes(option.id)}
                        onClick={() => setFormats((current) => toggleValue(current, option.id))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="map-more__group">
                  <h2>Цена, BYN</h2>
                  <div className="map-price__values">
                    <div>
                      <span>от</span>
                      <b>{priceMin}</b>
                    </div>
                    <div>
                      <span>до</span>
                      <b>{priceMax}</b>
                    </div>
                  </div>
                  <div className="map-price__slider">
                    <div className="map-price__track" />
                    <div
                      className="map-price__fill"
                      style={{
                        left: `${((priceMin - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                        right: `${100 - ((priceMax - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={priceMin}
                      aria-label="Цена от"
                      onChange={(event) => setPrice({ min: Math.min(Number(event.target.value), priceMax - 1), max: priceMax })}
                    />
                    <input
                      type="range"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={priceMax}
                      aria-label="Цена до"
                      onChange={(event) => setPrice({ min: priceMin, max: Math.max(Number(event.target.value), priceMin + 1) })}
                    />
                  </div>
                  <div className="map-price__bounds">
                    <span>{priceBounds.min} BYN</span>
                    <span>{priceBounds.max} BYN</span>
                  </div>
                </div>
                <div className="map-more__group">
                  <h2>Опыт</h2>
                  <div className="map-more__opts">
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <button
                        key={option.years}
                        type="button"
                        className={`map-more__pill${minExperience === option.years ? " is-active" : ""}`}
                        aria-pressed={minExperience === option.years}
                        onClick={() => setMinExperience((current) => (current === option.years ? null : option.years))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="map-more__reset" onClick={resetFilters} disabled={filterCount === 0}>
                  Сбросить
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <section className="map-board">
          <div className="layout-container">
            <div className="map-stage">
              <div className="map-stage__map">
                <TrainerCatalogMap
                  features={features}
                  user={userPoint}
                  focus={openingFocus}
                  highlightKeys={highlightKeys}
                  onPinHover={onPinHover}
                  located={userPoint != null}
                  locating={locating}
                  onLocate={locate}
                  onBounds={onFrame}
                  showEmpty={areaReady && !loading && features.length === 0}
                  loading={loading && features.length > 0}
                  empty={(
                    <div>
                      <p>{loadError ? "Не удалось загрузить этот кадр." : `${emptyTitle}.`}</p>
                    </div>
                  )}
                />
              </div>
              <div className="map-stage__list">
                <div className="map-count">
                  {areaReady ? (
                    <>Найдено <b>{total}</b> {pluralRu(total, "тренер", "тренера", "тренеров")}</>
                  ) : mode === "search" ? "Ищем тренеров" : "Загружаем тренеров в этом кадре"}
                </div>
                {!areaReady ? (
                  <div className="map-people" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => <div key={index} className="map-skeleton" />)}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="cat-empty">
                    <h3>{loadError ? "Не удалось загрузить тренеров" : emptyTitle}</h3>
                    {loadError ? (
                      <p>Проверьте сеть и подвиньте карту ещё раз.</p>
                    ) : firstInSection ? (
                      <p>{TRAINER_INVITE_LINE}</p>
                    ) : matched != null && matched > 0 ? (
                      <p>Отдалите карту или сдвиньте её — тренеры за краем кадра появятся здесь.</p>
                    ) : null}
                    {firstInSection && !loadError ? (
                      <Link to="/join/trainer" className="map-join">Стать первым тренером в этом разделе</Link>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className={`map-people${loading ? " is-pending" : ""}`}>
                      {rows.map((trainer, index) => (
                        <div key={trainer.slug} className="map-person" style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}>
                          <CatalogTrainerCard
                            marked={pinSlugs.includes(trainer.slug)}
                            showContacts={false}
                            onHover={setCardSlug}
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
                        </div>
                      ))}
                    </div>
                    {nextCursor != null ? <div ref={sentinelRef} className="map-sentinel" /> : null}
                    {loadingMore ? <p className="map-loading">Подгружаем ещё</p> : null}
                  </>
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
.map-page { background: var(--white); overflow-anchor: none; }
.map-hero { padding-top: 12px; }
.map-hero .layout-container { display: grid; gap: 8px; }
.map-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 13px; line-height: 1.3; font-weight: var(--fw-title); color: var(--muted); }
.map-crumbs a { color: var(--muted); text-decoration: none; }
.map-crumbs a:hover { color: var(--primary); }
.map-hero h1 { margin: 0; font-size: var(--fs-page); line-height: 1.15; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.map-hero p { margin: 0; font-size: var(--fs-meta); line-height: 1.45; color: var(--muted); max-width: 68ch; }
.map-hero em { font-style: normal; color: var(--primary); }
.map-hero__search { width: 100%; margin-top: 8px; }
.map-join { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 22px; border-radius: var(--radius-control); background: var(--primary); color: #fff; font-size: 14px; font-weight: var(--fw-title); text-decoration: none; text-align: center; }
.map-join:hover { background: var(--primary-dark); }
@media (min-width: 768px) {
  .map-hero__search { display: none; }
}
.map-tax { position: relative; z-index: 5; margin-top: 16px; display: grid; gap: 12px; }
.map-more { position: relative; }
.map-more__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.map-more__applied { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; min-width: 0; }
.map-more__applied li { display: inline-flex; align-items: center; min-height: 44px; padding-left: 12px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); }
.map-more__applied li span { font-size: 13px; font-weight: var(--fw-title); line-height: 1.2; }
.map-more__applied button { width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: inherit; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.map-more__applied button svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; }
.map-more__applied button:hover { color: var(--primary-dark); }
.map-more__toggle { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.map-more__toggle:hover, .map-more__toggle.is-open { border-color: var(--primary); color: var(--primary); }
.map-more__toggle svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.16s ease; }
.map-more__toggle.is-open svg { transform: rotate(180deg); }
.map-more__count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 12px; font-weight: var(--fw-title); line-height: 22px; text-align: center; }
.map-more__panel { position: relative; z-index: 5; display: grid; gap: 16px; margin-top: 8px; padding: 16px; max-height: min(70vh, 720px); overflow: auto; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 16px; background: var(--white); box-shadow: 0 16px 36px rgba(var(--primary-rgb), 0.16); }
.map-filter__search input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); }
.map-filter__directions, .map-filter__children, .map-more__opts { display: flex; flex-wrap: wrap; gap: calc(6px * 0.9); }
.map-filter__branch { display: grid; gap: 8px; }
.map-filter__branch h3 { margin: 0; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.map-filter__suggest { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.map-filter__suggest button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 0; border-radius: var(--radius-control); background: var(--light-bg); color: var(--dark); font: inherit; font-size: 13px; font-weight: var(--fw-title); text-align: left; cursor: pointer; }
.map-filter__suggest small { color: var(--muted); font-size: 11px; font-weight: var(--fw-ui); }
.map-filter__empty { min-height: 36px; display: flex; align-items: center; padding: 0 10px; color: var(--muted); font-size: 13px; }
.map-more__group { display: grid; gap: 8px; }
.map-more__group h2 { margin: 0; font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.01em; line-height: 1.2; color: var(--muted); }
.map-more__pill { min-height: calc(44px * 0.9); padding: calc(7px * 0.9) calc(12px * 0.9); border: 1px solid transparent; border-radius: 999px; background: var(--light-bg); color: var(--dark); font: inherit; font-size: calc(var(--fs-caption) * 0.9); font-weight: var(--fw-ui); cursor: pointer; }
.map-more__pill:hover { background: rgba(var(--primary-rgb), 0.08); }
.map-more__pill.is-active { background: var(--primary); color: #fff; }
.map-more__reset { justify-self: start; width: 100%; min-height: 40px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--dark); font: inherit; font-size: 13px; font-weight: var(--fw-heading); cursor: pointer; }
.map-more__reset:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.map-more__reset:disabled { color: var(--muted); cursor: default; }
.map-price__values { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; color: var(--dark); }
.map-price__values div:last-child { text-align: right; }
.map-price__values span { display: block; color: var(--muted); font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
.map-price__values b { font-size: 14px; font-weight: var(--fw-title); color: var(--ink); }
.map-price__slider { position: relative; height: 28px; margin: 0 10px; }
.map-price__track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%); background: var(--line); border-radius: 999px; }
.map-price__fill { position: absolute; top: 50%; height: 4px; transform: translateY(-50%); background: var(--primary); border-radius: 999px; }
.map-price__slider input[type="range"] { position: absolute; left: -10px; right: -10px; top: 0; width: calc(100% + 20px); height: 28px; appearance: none; background: transparent; pointer-events: none; margin: 0; }
.map-price__slider input[type="range"]::-webkit-slider-thumb { appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(var(--dark-rgb), 0.18); cursor: pointer; pointer-events: auto; }
.map-price__slider input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(var(--dark-rgb), 0.18); cursor: pointer; pointer-events: auto; }
.map-price__slider input[type="range"]::-moz-range-track { background: transparent; }
.map-price__bounds { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; margin-top: 6px; }
.map-tax__btn { flex: 0 0 auto; min-height: calc(44px * 0.9); display: inline-flex; align-items: center; gap: 6px; padding: calc(4px * 0.9) calc(12px * 0.9) calc(4px * 0.9) 6px; border: 1px solid transparent; border-radius: 999px; background: var(--light-bg); color: var(--dark); font: inherit; font-size: calc(var(--fs-caption) * 0.9); font-weight: var(--fw-ui); white-space: nowrap; cursor: pointer; }
.map-tax__btn img { width: 20px; height: 20px; flex: 0 0 auto; object-fit: contain; display: block; }
.map-tax__btn svg { width: 18px; height: 18px; flex: 0 0 auto; }
.map-tax__btn:hover { background: rgba(var(--primary-rgb), 0.08); }
.map-tax__btn.is-active { background: var(--primary); color: #fff; }
.map-tax__btn.is-active img { filter: brightness(0) invert(1); }
.map-board { padding-top: 16px; padding-bottom: 28px; }
.map-board .layout-container { display: grid; gap: 12px; }
.map-stage { display: grid; gap: var(--layout-gap); align-items: start; }
.map-stage__map, .map-stage__list { min-width: 0; }
.map-count { margin: 0 0 12px; font-size: 15px; color: var(--muted); font-weight: var(--fw-ui); }
.map-count b { color: var(--dark); font-weight: var(--fw-title); }
.map-people { display: grid; grid-template-columns: 1fr; gap: var(--layout-gap); }
.map-people.is-pending { opacity: 0.72; }
.map-person { min-width: 0; animation: map-card-in 0.34s ease both; }
@keyframes map-card-in { from { opacity: 0; } to { opacity: 1; } }
.map-skeleton { height: 248px; border-radius: var(--card-radius); background: linear-gradient(90deg, var(--light-bg) 25%, #fff 50%, var(--light-bg) 75%); background-size: 200% 100%; animation: map-shimmer 1.1s ease infinite; }
@keyframes map-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.map-sentinel { height: 1px; }
.map-loading { margin: 12px 0 0; color: var(--muted); font-size: 14px; }
.map-people .trainer-card { transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease; }
.map-people .trainer-card__media { aspect-ratio: 1 / 1; }
.map-people .trainer-card__body { gap: 4px; padding: 10px 10px 12px; }
.map-people .trainer-card__name { font-size: 13px; line-height: 1.15; letter-spacing: 0; }
.map-people .trainer-name { flex-direction: column; align-items: flex-start; gap: 0; }
.map-people .trainer-card__sport { font-size: 12px; line-height: 1.3; }
.map-people .trainer-card__price { font-size: 13px; }
.map-people .trainer-card__footer { margin-top: 0; padding-top: 8px; }
.map-people .trainer-card__save {
  top: 2px; right: 2px; background: transparent; box-shadow: none;
}
.map-people .trainer-card__save svg {
  width: 28px; height: 28px; padding: 7px; border-radius: 50%; box-sizing: border-box;
  background: rgba(255, 255, 255, 0.92); box-shadow: 0 4px 12px rgba(var(--dark-rgb), 0.12);
}
.map-people .trainer-card.is-marked { border-color: var(--primary); background: var(--primary); color: #fff; box-shadow: 0 12px 28px rgba(var(--primary-rgb), 0.28); }
.map-people .trainer-card.is-marked .trainer-card__name,
.map-people .trainer-card.is-marked:hover .trainer-card__name,
.map-people .trainer-card.is-marked:focus-visible .trainer-card__name,
.map-people .trainer-card.is-marked .trainer-card__sport,
.map-people .trainer-card.is-marked .trainer-card__price,
.map-people .trainer-card.is-marked .trainer-card__price small,
.map-people .trainer-card.is-marked .trainer-card__location,
.map-people .trainer-card.is-marked .trainer-card__rating,
.map-people .trainer-card.is-marked .trainer-card__rating span { color: #fff; }
.map-people .trainer-card.is-marked .trainer-card__footer { border-top-color: rgba(255, 255, 255, 0.35); }
.map-people .trainer-card.is-marked .trainer-card__rating svg { fill: #fff; stroke: #fff; }
.cat-empty { padding: 28px 16px; text-align: center; border-radius: var(--card-radius); border: 1px solid rgba(var(--primary-rgb), 0.16); background: rgba(var(--primary-rgb), 0.04); display: grid; gap: 8px; justify-items: center; }
.cat-empty h3 { margin: 0; font-size: 20px; font-weight: var(--fw-heading); color: var(--dark); }
.cat-empty p { margin: 0; color: var(--muted); font-size: 14px; }
@media (max-width: 640px) {
  .map-join { width: 100%; }
}
@media (min-width: 720px) {
  .map-people { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 960px) {
  .map-stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .map-stage__map { position: sticky; top: 12px; }
}
`;
