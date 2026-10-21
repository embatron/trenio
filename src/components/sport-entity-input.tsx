import { useEffect, useId, useMemo, useRef, useState } from "react";

import { listSecondLevelSports, MAX_TRAINER_SPORTS } from "@/lib/catalog/sport-taxonomy";

export function SportEntityInput({
  value,
  onChange,
  max = MAX_TRAINER_SPORTS,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  max?: number;
}) {
  const sports = useMemo(() => listSecondLevelSports(), []);
  const bySlug = useMemo(() => new Map(sports.map((sport) => [sport.slug, sport])), [sports]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = value.flatMap((slug) => {
    const sport = bySlug.get(slug);
    return sport ? [sport] : [];
  });
  const needle = query.trim().toLowerCase();
  const matches = sports.filter((sport) => {
    if (value.includes(sport.slug)) return false;
    if (!needle) return true;
    return sport.label.toLowerCase().includes(needle)
      || sport.parentLabel.toLowerCase().includes(needle)
      || sport.aliases?.some((alias) => alias.toLowerCase().includes(needle));
  }).slice(0, 8);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function add(slug: string) {
    if (value.includes(slug) || value.length >= max) return;
    onChange([...value, slug]);
    setQuery("");
    setOpen(true);
  }

  function remove(slug: string) {
    onChange(value.filter((item) => item !== slug));
  }

  return (
    <div className="entity-input" ref={boxRef}>
      {selected.map((sport) => (
        <button key={sport.slug} type="button" className="entity-chip" onClick={() => remove(sport.slug)}>
          {sport.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <input
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Виды спорта"
        placeholder={value.length >= max ? "Уже четыре" : selected.length === 0 ? "Найти вид спорта" : ""}
        disabled={value.length >= max}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (matches[0]) add(matches[0].slug);
          }
          if (event.key === "Backspace" && query === "" && selected.length > 0) {
            remove(selected[selected.length - 1].slug);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && matches.length > 0 ? (
        <ul className="entity-menu" id={listId} role="listbox">
          {matches.map((sport) => (
            <li key={sport.slug}>
              <button type="button" role="option" onClick={() => add(sport.slug)}>
                {sport.label}
                <span>{sport.parentLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
