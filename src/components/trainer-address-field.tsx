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
  suggestionLines,
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
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const text = draft ?? placeLine(place);
  const query = text.trim().replace(/\s+/g, " ");
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
          setActive(0);
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

  function finishEditing() {
    setOpen(false);
    if (draft == null) return;
    const cleaned = draft.replace(/[ \t]+/g, " ").trim();
    setDraft(null);
    if (cleaned === placeLine(place)) return;
    onChange({
      city: "",
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
  }, [showMenu, suggestions.length, loading]);

  function choose(hit: AddressSuggestion) {
    setDraft(null);
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
    const cleaned = query;
    setDraft(null);
    onChange({
      city: "",
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
    onChange(EMPTY_TRAINER_PLACE);
    setSuggestions([]);
    setOpen(false);
  }

  function write(next: string) {
    setDraft(next);
    setOpen(true);
    setActive(0);
    const cleaned = next.replace(/[ \t]+/g, " ").trim();
    if (cleaned === placeLine(place)) return;
    onChange({
      city: "",
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
        placeholder="Улица, дом, город"
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
        <button className="address-field__clear" type="button" aria-label="Очистить адрес" onMouseDown={(event) => event.preventDefault()} onClick={clear}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
      {place.geocodeStatus && draft == null ? <span className={`geo-badge geo-badge--${place.geocodeStatus}`}>{STATUS_LABEL[place.geocodeStatus]}</span> : null}
      {showMenu ? (
        <ul className="entity-menu address-field__menu" id={listId} role="listbox">
          {loading && suggestions.length === 0 ? <li className="address-field__status">Ищем адрес…</li> : null}
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
          {!loading && suggestions.length === 0 ? (
            <li>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={keepText}>Не нашли адрес? Просто сохраните текст</button>
            </li>
          ) : null}
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
