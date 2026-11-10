import { useEffect, useId, useMemo, useRef, useState } from "react";

import { trainerSportMenu } from "@/lib/catalog/catalog-sports";
import { listSecondLevelSports, MAX_TRAINER_SPORTS, trainerSectionBySlug } from "@/lib/catalog/sport-taxonomy";
import { pluralRu } from "@/lib/ru-plural";

export function SportEntityInput({
  value,
  onChange,
  max = MAX_TRAINER_SPORTS,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  max?: number;
}) {
  const sports = useMemo(() => {
    const children = listSecondLevelSports();
    const seen = new Set<string>();
    const sections = [];
    for (const child of children) {
      if (seen.has(child.parentSlug)) continue;
      seen.add(child.parentSlug);
      const section = trainerSectionBySlug(child.parentSlug);
      if (section) sections.push({ slug: section.slug, label: section.label, parentSlug: section.slug, parentLabel: "Раздел" });
    }
    return [...children, ...sections];
  }, []);
  const bySlug = useMemo(() => new Map(sports.map((sport) => [sport.slug, sport])), [sports]);
  const [query, setQuery] = useState("");
  const [openedSection, setOpenedSection] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const known = value.filter((slug) => bySlug.has(slug));
  const selected = known.flatMap((slug) => {
    const sport = bySlug.get(slug);
    return sport ? [sport] : [];
  });
  const menu = useMemo(
    () => trainerSportMenu(query, query.trim() ? null : openedSection),
    [openedSection, query],
  );
  const choices = menu.sports.filter((sport) => !known.includes(sport.slug));

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function add(slug: string) {
    if (known.includes(slug) || known.length >= max) return;
    onChange([...known, slug]);
    setQuery("");
    setOpen(true);
  }

  function remove(slug: string) {
    onChange(known.filter((item) => item !== slug));
  }

  function openSection(slug: string) {
    setOpenedSection(slug);
    setQuery("");
    setOpen(true);
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
        aria-autocomplete="list"
        aria-label="Виды спорта"
        placeholder={known.length >= max ? "Уже четыре" : selected.length === 0 ? "Найти раздел или вид" : ""}
        disabled={known.length >= max}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const section = menu.section && trainerSectionBySlug(menu.section.slug);
            if (section && !known.includes(section.slug)) add(section.slug);
            else if (choices[0]) add(choices[0].slug);
            else if (!query.trim() && menu.sections[0]) openSection(menu.sections[0].slug);
          }
          if (event.key === "Backspace" && query === "" && selected.length > 0) {
            remove(selected[selected.length - 1].slug);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && known.length < max && query.trim() && !menu.section && menu.sections.length === 0 && choices.length === 0 ? (
        <ul className="entity-menu entity-menu--tall" id={listId}>
          <li className="entity-menu__hint"><p>Нет такого вида. Откройте раздел или поправьте название.</p></li>
        </ul>
      ) : null}
      {open && known.length < max && (menu.section || menu.sections.length > 0 || choices.length > 0) ? (
        <ul className="entity-menu entity-menu--tall" id={listId} role="listbox">
          {menu.section ? (
            <li className="entity-menu__hint">
              <p>{trainerSectionBySlug(menu.section.slug)
                ? `${menu.section.label} — раздел. Его можно назначить целиком или выбрать вид внутри.`
                : `${menu.section.label} — раздел. Выберите вид внутри него.`}</p>
              {query.trim() === "" ? (
                <button type="button" onClick={() => setOpenedSection(null)}>Все разделы</button>
              ) : null}
            </li>
          ) : null}
          {menu.section && trainerSectionBySlug(menu.section.slug) && !known.includes(menu.section.slug) ? (
            <li>
              <button
                type="button"
                role="option"
                onPointerDown={(event) => {
                  event.preventDefault();
                  add(menu.section!.slug);
                }}
                onClick={() => add(menu.section!.slug)}
              >
                {menu.section.label}
                <span>весь раздел</span>
              </button>
            </li>
          ) : null}
          {menu.sections.map((section) => (
            <li key={section.slug}>
              <button
                type="button"
                role="option"
                onPointerDown={(event) => {
                  event.preventDefault();
                  openSection(section.slug);
                }}
                onClick={() => openSection(section.slug)}
              >
                {section.label}
                <span>раздел, {section.count} {pluralRu(section.count, "вид", "вида", "видов")}</span>
              </button>
            </li>
          ))}
          {choices.map((sport) => (
            <li key={sport.id}>
              <button
                type="button"
                role="option"
                onPointerDown={(event) => {
                  event.preventDefault();
                  add(sport.slug);
                }}
                onClick={() => add(sport.slug)}
              >
                {sport.label}
                <span>{sport.parentLabel}</span>
              </button>
            </li>
          ))}
          {menu.section && choices.length === 0 && (!trainerSectionBySlug(menu.section.slug) || known.includes(menu.section.slug)) ? (
            <li className="entity-menu__hint"><p>Все виды этого раздела уже выбраны.</p></li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
