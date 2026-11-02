import { useEffect, useId, useRef, useState } from "react";

import { CityEntityInput } from "@/components/city-entity-input";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { suggestAddress } from "@/lib/geo/functions";
import {
  BELARUS_COUNTRY,
  EMPTY_TRAINER_PLACE,
  MAP_TEMPORARILY_UNAVAILABLE,
  MAX_TRAINING_PLACES,
  suggestionLines,
  type AddressSuggestion,
  type GeocodeStatus,
  type TrainerPlace,
} from "@/lib/geo/schemas";

const SUGGEST_WAIT_MS = 400;
const MAP_WAIT_MS = 12_000;

const STATUS_LABEL: Record<Exclude<GeocodeStatus, "ok">, string> = {
  not_found: "Адрес не найден",
  pending: "На карте ещё не отмечен",
};

function suggestQuery(street: string, city: string) {
  const text = street.trim().replace(/\s+/g, " ");
  const place = city.trim();
  if (!place || text.toLowerCase().includes(place.toLowerCase())) return text.slice(0, 200);
  return `${text}, ${place}`.slice(0, 200);
}

function streetFromHit(hit: AddressSuggestion) {
  const street = hit.street.trim();
  if (street && street !== hit.displayName.trim()) return street.slice(0, 200);
  return suggestionLines(hit).main.slice(0, 200);
}

function PlaceInput({
  place,
  city,
  onChange,
}: {
  place: TrainerPlace;
  city: string;
  onChange: (place: TrainerPlace) => void;
}) {
  const suggest = useAuthServerFn(suggestAddress);
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const text = draft ?? place.address;
  const query = text.trim().replace(/\s+/g, " ");
  const lookupQuery = suggestQuery(query, city);
  const showMenu = open && query.length >= 3;

  useEffect(() => {
    if (!showMenu) return;
    let cancelled = false;
    let gaveUp = false;
    const fail = window.setTimeout(() => {
      if (cancelled) return;
      gaveUp = true;
      setLoading(false);
      setSuggestions([]);
      setOpen(false);
      setMapError(MAP_TEMPORARILY_UNAVAILABLE);
    }, MAP_WAIT_MS);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      void suggestRef
        .current({ data: { query: lookupQuery } })
        .then((result) => {
          if (cancelled || gaveUp) return;
          window.clearTimeout(fail);
          const payload = result as { suggestions: AddressSuggestion[]; unavailable?: boolean };
          if (payload.unavailable) {
            setSuggestions([]);
            setOpen(false);
            setMapError(MAP_TEMPORARILY_UNAVAILABLE);
            return;
          }
          setMapError(null);
          setSuggestions(payload.suggestions);
          setActive(0);
        })
        .catch((error: unknown) => {
          if (cancelled || gaveUp) return;
          window.clearTimeout(fail);
          const message = authErrorMessage(error);
          if (message.startsWith("Слишком много")) return;
          setSuggestions([]);
          setOpen(false);
          setMapError(MAP_TEMPORARILY_UNAVAILABLE);
        })
        .finally(() => {
          if (!cancelled && !gaveUp) setLoading(false);
        });
    }, SUGGEST_WAIT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(fail);
    };
  }, [lookupQuery, showMenu]);

  function finishEditing() {
    setOpen(false);
    if (draft == null) return;
    const cleaned = draft.replace(/[ \t]+/g, " ").trim();
    setDraft(null);
    if (cleaned === place.address.trim()) return;
    onChange({
      city,
      district: "",
      address: cleaned,
      lat: null,
      lng: null,
      geocodeStatus: null,
    });
  }

  const finishRef = useRef(finishEditing);
  finishRef.current = finishEditing;
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) finishRef.current();
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const previous = document.body.style.paddingBottom;
    const lift = () => {
      const box = boxRef.current;
      const input = box?.querySelector("input");
      const menu = box?.querySelector(".address-field__menu");
      if (!input || !menu) return;
      const narrow = window.innerWidth < 768;
      const header = document.querySelector(".site-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const field = input.getBoundingClientRect();
      const sheet = menu.getBoundingClientRect();
      const limit = narrow ? sheet.top - 8 : window.innerHeight - 8;
      const covered = narrow ? field.bottom - limit : sheet.bottom - limit;
      const maxShift = Math.max(0, field.top - (headerBottom + 8));
      const shift = Math.min(Math.max(0, covered), maxShift);
      if (shift <= 1) return;
      document.body.style.paddingBottom = `${Math.ceil(shift + 16)}px`;
      window.scrollBy(0, shift);
    };
    const frame = window.requestAnimationFrame(lift);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.paddingBottom = previous;
    };
  }, [showMenu, suggestions.length, loading, mapError]);

  function choose(hit: AddressSuggestion) {
    setDraft(null);
    setMapError(null);
    onChange({
      city: city.trim() || hit.city,
      district: hit.district,
      address: streetFromHit(hit),
      lat: hit.lat,
      lng: hit.lng,
      geocodeStatus: "ok",
    });
    setSuggestions([]);
    setOpen(false);
  }

  function keepText() {
    const cleaned = query;
    setDraft(null);
    setMapError(null);
    onChange({
      city,
      district: "",
      address: cleaned,
      lat: null,
      lng: null,
      geocodeStatus: cleaned ? "pending" : null,
    });
    setOpen(false);
  }

  function clear() {
    setDraft(null);
    setMapError(null);
    onChange({ ...EMPTY_TRAINER_PLACE, city });
    setSuggestions([]);
    setOpen(false);
  }

  function write(next: string) {
    setDraft(next);
    setMapError(null);
    setOpen(true);
    setActive(0);
    const cleaned = next.replace(/[ \t]+/g, " ").trim();
    if (cleaned === place.address.trim()) return;
    onChange({
      city,
      district: "",
      address: next,
      lat: null,
      lng: null,
      geocodeStatus: null,
    });
  }

  return (
    <div className="address-field" ref={boxRef}>
      <input
        value={text}
        maxLength={200}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Улица и дом"
        onFocus={() => setOpen(true)}
        onChange={(event) => write(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!showMenu) {
            if (event.key === "Enter") event.preventDefault();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const hit = suggestions[active] ?? suggestions[0];
            if (hit) choose(hit);
          }
        }}
      />
      {text ? (
        <button
          className="address-field__clear"
          type="button"
          aria-label="Очистить адрес"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clear}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
      {place.geocodeStatus && place.geocodeStatus !== "ok" && draft == null ? (
        <span className={`geo-badge geo-badge--${place.geocodeStatus}`}>
          {STATUS_LABEL[place.geocodeStatus]}
        </span>
      ) : null}
      {mapError ? (
        <p className="address-field__notice" role="status">
          {mapError}
        </p>
      ) : null}
      {showMenu ? (
        <ul className="entity-menu address-field__menu" id={listId} role="listbox">
          {loading && suggestions.length === 0 && !mapError ? (
            <li className="address-field__status">Ищем адрес…</li>
          ) : null}
          {suggestions.map((hit, index) => {
            const lines = suggestionLines(hit);
            return (
              <li key={`${hit.lat},${hit.lng},${hit.displayName}`}>
                <button
                  className={index === active ? "address-hit is-active" : "address-hit"}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(hit)}
                >
                  <span className="address-hit__main">{lines.main}</span>
                  {lines.meta ? <span className="address-hit__meta">{lines.meta}</span> : null}
                </button>
              </li>
            );
          })}
          {!loading && suggestions.length === 0 && !mapError ? (
            <li>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={keepText}
              >
                Не нашли адрес? Просто сохраните текст
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function addressHasText(place: TrainerPlace) {
  return Boolean(place.address.trim() || place.district.trim());
}

export function TrainerPlacesField({
  city,
  places,
  onChange,
}: {
  city: string;
  places: TrainerPlace[];
  onChange: (next: { city?: string; places?: TrainerPlace[] }) => void;
}) {
  const rows = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    if (confirmIndex == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmIndex]);

  function update(index: number, place: TrainerPlace) {
    const base = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];
    const hasStreet = Boolean(place.address.trim() || place.district.trim());
    const nextCity = city.trim() || place.city.trim();
    const nextPlace = hasStreet ? { ...place, city: nextCity } : { ...EMPTY_TRAINER_PLACE };
    onChange({
      places: base.map((item, itemIndex) => (itemIndex === index ? nextPlace : item)),
      ...(hasStreet && nextCity && nextCity !== city ? { city: nextCity } : {}),
    });
  }

  function changeCity(next: string) {
    onChange({
      city: next,
      places: places.map((place) => {
        if (!place.address.trim() && !place.district.trim()) return { ...EMPTY_TRAINER_PLACE };
        if (place.city === next) return place;
        return {
          ...place,
          city: next,
          district: "",
          lat: null,
          lng: null,
          geocodeStatus: null,
        };
      }),
    });
  }

  function add() {
    const base = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];
    if (base.length >= MAX_TRAINING_PLACES) return;
    onChange({ places: [...base, { ...EMPTY_TRAINER_PLACE }] });
  }

  function remove(index: number) {
    onChange({ places: places.filter((_, itemIndex) => itemIndex !== index) });
  }

  return (
    <fieldset className="places-field">
      <label>
        <span>Страна</span>
        <input value={BELARUS_COUNTRY} readOnly tabIndex={-1} aria-readonly="true" />
      </label>
      <label>
        <span>Город</span>
        <CityEntityInput value={city} onChange={changeCity} />
      </label>
      {rows.map((place, index) => {
        const removable = rows.length > 1 || addressHasText(place);
        return (
          <div className="places-field__row" key={index}>
            <label>
              <span>{rows.length > 1 ? `Адрес ${index + 1}` : "Адрес"}</span>
              <div className={removable ? "places-field__line has-remove" : "places-field__line"}>
                <PlaceInput place={place} city={city} onChange={(next) => update(index, next)} />
                {removable ? (
                  <button
                    className="cabinet-icon-btn places-field__remove"
                    type="button"
                    aria-label={rows.length > 1 ? `Убрать адрес ${index + 1}` : "Убрать адрес"}
                    onClick={() => setConfirmIndex(index)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M10 7V5h4v2" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        );
      })}
      {rows.length < MAX_TRAINING_PLACES ? (
        <button className="places-field__add" type="button" onClick={add}>
          Добавить адрес
        </button>
      ) : null}
      <p className="cabinet-note">
        До трех адресов
      </p>
      {confirmIndex != null ? (
        <div className="cabinet-modal" onClick={() => setConfirmIndex(null)}>
          <div
            className="cabinet-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-place-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="remove-place-title">Убрать адрес?</h2>
            <p>Строка пропадёт из профиля. Чтобы это сохранилось, нажмите «Сохранить».</p>
            <div className="cabinet-modal__actions">
              <button
                type="button"
                className="cabinet-form__ghost"
                onClick={() => setConfirmIndex(null)}
              >
                Оставить
              </button>
              <button
                type="button"
                onClick={() => {
                  remove(confirmIndex);
                  setConfirmIndex(null);
                }}
              >
                Убрать
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
