import { useEffect, useId, useMemo, useRef, useState } from "react";

import { filterBelarusCities } from "@/lib/catalog/city-taxonomy";

/** One city. The field shows the selected name, and suggestions only replace it. */
export function CityEntityInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (city: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const text = query ?? value;
  const matches = useMemo(() => filterBelarusCities(text), [text]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function choose(city: string) {
    onChange(city);
    setQuery(null);
    setOpen(false);
  }

  return (
    <div className="entity-input" ref={boxRef}>
      <input
        value={text}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Город"
        placeholder="Найти город"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value.trim() === "") onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const exact = matches.find((city) => city.toLowerCase() === text.trim().toLowerCase());
            if (exact) choose(exact);
            else if (matches[0] && text.trim()) choose(matches[0]);
          }
          if (event.key === "Escape") {
            setQuery(null);
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 ? (
        <ul className="entity-menu" id={listId} role="listbox">
          {matches.map((city) => (
            <li key={city}>
              <button type="button" role="option" aria-selected={city === value} onClick={() => choose(city)}>{city}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
