import { useEffect, useId, useRef, useState } from "react";

import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { suggestAddress } from "@/lib/geo/functions";
import {
  BELARUS_COUNTRY,
  EMPTY_TRAINER_PLACE,
  MAX_TRAINING_PLACES,
  placeHasText,
  placeLine,
  type AddressSuggestion,
  type GeocodeStatus,
  type TrainerPlace,
} from "@/lib/geo/schemas";

const SUGGEST_WAIT_MS = 400;

const STATUS_LABEL: Record<GeocodeStatus, string> = {
  ok: "Координаты найдены",
  not_found: "Адрес не найден",
  pending: "Ожидает геокодирования",
};

function PlaceInput({
  place,
  onChange,
}: {
  place: TrainerPlace;
  onChange: (place: TrainerPlace) => void;
}) {
  const suggest = useAuthServerFn(suggestAddress);
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const text = placeLine(place);
  const query = text.trim();
  const showMenu = open && query.length >= 3;

  useEffect(() => {
    if (!showMenu) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void suggestRef.current({ data: { query } })
        .then((result) => {
          if (cancelled) return;
          setSuggestions((result as { suggestions: AddressSuggestion[] }).suggestions);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const message = authErrorMessage(error);
          if (message.startsWith("Слишком много")) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SUGGEST_WAIT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [showMenu]);

  function choose(hit: AddressSuggestion) {
    onChange({
      city: hit.city,
      district: hit.district,
      address: hit.street || hit.displayName,
      lat: hit.lat,
      lng: hit.lng,
      geocodeStatus: "ok",
    });
    setSuggestions([]);
    setOpen(false);
  }

  function keepText() {
    onChange({
      city: "",
      district: "",
      address: query,
      lat: null,
      lng: null,
      geocodeStatus: "pending",
    });
    setOpen(false);
  }

  function clear() {
    onChange(EMPTY_TRAINER_PLACE);
    setSuggestions([]);
    setOpen(false);
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
        placeholder="Улица, дом, город"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange({
            city: "",
            district: "",
            address: event.target.value,
            lat: null,
            lng: null,
            geocodeStatus: null,
          });
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      {text ? (
        <button className="address-field__clear" type="button" aria-label="Очистить адрес" onClick={clear}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
      {place.city || place.address ? (
        <p className="places-field__parts">{[place.city, place.address].filter(Boolean).join(" · ")}</p>
      ) : null}
      {place.geocodeStatus ? <span className={`geo-badge geo-badge--${place.geocodeStatus}`}>{STATUS_LABEL[place.geocodeStatus]}</span> : null}
      {showMenu ? (
        <ul className="entity-menu address-field__menu" id={listId} role="listbox">
          {loading && suggestions.length === 0 ? <li className="address-field__status">Ищем адрес…</li> : null}
          {suggestions.map((hit) => (
            <li key={`${hit.lat},${hit.lng},${hit.displayName}`}>
              <button type="button" role="option" aria-selected={hit.lat === place.lat && hit.lng === place.lng} onClick={() => choose(hit)}>
                {hit.displayName}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={keepText}>Не нашли адрес? Просто сохраните текст</button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export function TrainerPlacesField({
  places,
  onChange,
}: {
  places: TrainerPlace[];
  onChange: (places: TrainerPlace[]) => void;
}) {
  const rows = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];

  function update(index: number, place: TrainerPlace) {
    const base = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];
    onChange(base.map((item, itemIndex) => (itemIndex === index ? place : item)));
  }

  function add() {
    const base = places.length > 0 ? places : [EMPTY_TRAINER_PLACE];
    if (base.length >= MAX_TRAINING_PLACES) return;
    onChange([...base, { ...EMPTY_TRAINER_PLACE }]);
  }

  function remove(index: number) {
    onChange(places.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <fieldset className="places-field">
      <legend>Места, где я тренирую</legend>
      <label>
        <span>Страна</span>
        <input value={BELARUS_COUNTRY} readOnly tabIndex={-1} aria-readonly="true" />
      </label>
      {rows.map((place, index) => (
        <div className="places-field__row" key={index}>
          <label>
            <span>Адрес {rows.length > 1 ? index + 1 : ""}</span>
            <PlaceInput place={place} onChange={(next) => update(index, next)} />
          </label>
          {places.some(placeHasText) || rows.length > 1 ? (
            <button className="places-field__remove" type="button" onClick={() => remove(index)}>
              Убрать
            </button>
          ) : null}
        </div>
      ))}
      {rows.length < MAX_TRAINING_PLACES ? (
        <button className="places-field__add" type="button" onClick={add}>
          Добавить адрес
        </button>
      ) : null}
      <p className="cabinet-note">До трёх адресов. Только Беларусь, подсказки на русском. Адрес другой страны не сохранится.</p>
    </fieldset>
  );
}
