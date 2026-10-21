import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { renderLocationSuggestions } from "@/lib/catalog/location-suggestions";
import { DEFAULT_SEARCH_CITY, resolveSearchCity } from "@/lib/catalog/search-city";
import { renderSportSuggestions } from "@/lib/catalog/sport-suggestions";

export type CatalogSearchAudience = "adult" | "child";
export type CatalogSearchFormat = "individual" | "group";

const SYNC_EVENT = "trenio-search-sync";

type SyncDetail = {
  source: HTMLElement;
  sport?: string;
  location?: string;
  audience?: CatalogSearchAudience;
  format?: CatalogSearchFormat;
};

const FORM_CSS = `
.catalog-search { width: 100%; }
.catalog-search.search-block--hero { max-width: 800px; margin: 0 auto; }
.catalog-search.search-block--header { width: min(100%, 700px); max-width: 100%; min-width: 0; }
.catalog-search .search-intent { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; margin: 0 auto 16px; color: var(--muted); font-size: 16px; font-weight: var(--fw-title); }
.catalog-search .intent-group { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 7px; }
.catalog-search .intent-label { color: var(--muted); font-weight: var(--fw-heading); }
.catalog-search .audience-tab, .catalog-search .format-tab {
  border: 0; background: rgba(255, 255, 255, 0.7); border-radius: 999px; min-height: 44px; padding: 7px 12px;
  font-size: 15px; font-weight: var(--fw-title); color: var(--muted); opacity: 0.5; cursor: pointer;
}
.catalog-search .audience-tab.is-active, .catalog-search .format-tab.is-active { background: var(--primary); color: #fff; opacity: 1; }
.catalog-search .search-shell {
  min-height: 62px; padding: 7px 8px; background: var(--white);
  border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: 999px;
  box-shadow: 0 12px 36px rgba(var(--dark-rgb), 0.08);
  display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) auto;
  align-items: center; gap: 0; text-align: left;
}
.catalog-search .search-field { min-width: 0; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 20px; }
.catalog-search .search-field + .search-field { border-left: 1px solid var(--line); }
.catalog-search .search-icon { flex: 0 0 auto; display: grid; place-items: center; color: var(--muted); }
.catalog-search .search-icon svg, .catalog-search .intent-dropdown__trigger svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.catalog-search .field-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.catalog-search .combo-select { position: relative; min-width: 0; }
.catalog-search .combo-input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: var(--text); font-size: 18px; font-weight: 500; }
.catalog-search .combo-input::placeholder { color: var(--muted); }
.catalog-search .combo-menu {
  position: absolute; z-index: 5; top: calc(100% + 12px); left: 8px; right: 8px;
  min-width: 220px; max-height: 320px; overflow-y: auto; padding: 7px;
  border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: var(--card-radius);
  background: var(--white); box-shadow: 0 18px 46px rgba(var(--dark-rgb), 0.13); display: none;
}
.catalog-search .combo-select.is-open .combo-menu { display: grid; gap: 1px; }
.catalog-search .combo-option { border: 0; width: 100%; min-height: 44px; padding: 0 13px; border-radius: var(--radius-control); background: transparent; color: var(--text); cursor: pointer; font-size: 15px; font-weight: var(--fw-title); text-align: left; }
.catalog-search .combo-option:hover, .catalog-search .combo-option.is-active { background: var(--light-bg); color: var(--primary-dark); }
.catalog-search .search-submit { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--primary); color: #fff; cursor: pointer; display: grid; place-items: center; }
.catalog-search .search-submit svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.catalog-search.search-block--header .search-shell {
  min-height: 52px; padding: 4px 5px; box-shadow: 0 4px 18px rgba(var(--dark-rgb), 0.06);
  grid-template-columns: minmax(0, 124fr) minmax(0, 168fr) minmax(0, 198fr) minmax(0, 156fr) 44px;
}
.catalog-search.search-block--header .search-field { height: 44px; padding: 0 11px; gap: 7px; }
.catalog-search.search-block--header .combo-input { font-size: 14px; }
.catalog-search.search-block--header .search-icon svg, .catalog-search.search-block--header .intent-dropdown__trigger svg { width: 16px; height: 16px; }
.catalog-search.search-block--header .search-submit { width: 44px; height: 44px; }
.catalog-search.search-block--header .search-submit svg { width: 17px; height: 17px; }
.catalog-search .intent-dropdown__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 7px;
  width: 100%; min-width: 0; min-height: 37px; padding: 0; border: 0; background: transparent;
  color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer;
}
.catalog-search .intent-dropdown__value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 720px) {
  .catalog-search.search-block--header, .catalog-search.search-block--header .search-shell { width: 100%; }
  .catalog-search.search-block--header .search-field { padding-inline: 8px; gap: 5px; }
  .catalog-search.search-block--header .search-shell {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.28fr) 37px;
    grid-template-rows: 37px 37px; min-height: 0;
  }
  .catalog-search.search-block--header .search-field[data-intent-dropdown="audience"] { grid-column: 1; grid-row: 1; border-left: 0; }
  .catalog-search.search-block--header .search-field[data-intent-dropdown="format"] { grid-column: 2; grid-row: 1; }
  .catalog-search.search-block--header .search-field[data-combo="sport"] { grid-column: 1; grid-row: 2; border-left: 0; border-top: 1px solid var(--line); }
  .catalog-search.search-block--header .search-field[data-combo="location"] { grid-column: 2; grid-row: 2; border-top: 1px solid var(--line); }
  .catalog-search.search-block--header .search-submit { grid-column: 3; grid-row: 1 / span 2; align-self: center; }
  .catalog-search.search-block--hero .search-shell { grid-template-columns: minmax(0, 1fr) auto; }
  .catalog-search.search-block--hero .search-field[data-combo="sport"] { grid-column: 1; grid-row: 1; border-left: 0; }
  .catalog-search.search-block--hero .search-field[data-combo="location"] { grid-column: 1; grid-row: 2; border-left: 0; border-top: 1px solid var(--line); }
  .catalog-search.search-block--hero .search-submit { grid-column: 2; grid-row: 1 / span 2; }
}
@media (max-width: 620px) {
  .catalog-search .search-intent { font-size: 14px; }
  .catalog-search .search-field { padding-inline: 12px; }
  .catalog-search .combo-input { font-size: 17px; }
}
`;

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CatalogSearchForm({
  variant,
  sport = "",
  location,
  audience = "adult",
  format = "individual",
}: {
  variant: "hero" | "header";
  sport?: string;
  location?: string;
  audience?: CatalogSearchAudience;
  format?: CatalogSearchFormat;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const locationTouched = useRef(Boolean(location?.trim()));
  const navigate = useNavigate();
  const fixedLocation = location?.trim() || "";

  useEffect(() => {
    locationTouched.current = Boolean(fixedLocation);
  }, [fixedLocation]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const listen = (target: EventTarget, type: string, handler: EventListener) => {
      target.addEventListener(type, handler);
      cleanups.push(() => target.removeEventListener(type, handler));
    };

    let activeAudience: CatalogSearchAudience = audience;
    let activeFormat: CatalogSearchFormat = format;

    const sportInput = root.querySelector<HTMLInputElement>('input[name="sport"]');
    const locationInput = root.querySelector<HTMLInputElement>('input[name="location"]');
    const form = root.querySelector<HTMLFormElement>("[data-search-form]");

    const writeInput = (input: HTMLInputElement | null, value: string) => {
      if (!input || input.value === value) return;
      input.dataset.syncing = "1";
      input.value = value;
      delete input.dataset.syncing;
    };

    const paintChoice = (kind: "audience" | "format", value: string) => {
      root.querySelectorAll<HTMLButtonElement>(`[data-${kind}]`).forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset[kind] === value);
      });
      root.querySelectorAll<HTMLElement>(`[data-intent-dropdown="${kind}"]`).forEach((field) => {
        field.querySelectorAll<HTMLElement>(".combo-option").forEach((opt) => {
          const active = opt.dataset.value === value;
          opt.classList.toggle("is-active", active);
          if (active) {
            const label = field.querySelector(".intent-dropdown__value");
            if (label) label.textContent = opt.dataset.label || "";
          }
        });
      });
    };

    const publish = (detail: Omit<SyncDetail, "source">) => {
      document.dispatchEvent(
        new CustomEvent<SyncDetail>(SYNC_EVENT, { detail: { ...detail, source: root } }),
      );
    };

    const setAudience = (value: string, broadcast: boolean) => {
      activeAudience = value === "child" ? "child" : "adult";
      paintChoice("audience", activeAudience);
      if (broadcast) publish({ audience: activeAudience });
    };
    const setFormat = (value: string, broadcast: boolean) => {
      activeFormat = value === "group" ? "group" : "individual";
      paintChoice("format", activeFormat);
      if (broadcast) publish({ format: activeFormat });
    };

    listen(document, SYNC_EVENT, ((event: Event) => {
      const detail = (event as CustomEvent<SyncDetail>).detail;
      if (!detail || detail.source === root) return;
      if (typeof detail.sport === "string") writeInput(sportInput, detail.sport);
      if (typeof detail.location === "string") {
        locationTouched.current = true;
        writeInput(locationInput, detail.location);
      }
      if (detail.audience) setAudience(detail.audience, false);
      if (detail.format) setFormat(detail.format, false);
    }) as EventListener);

    root.querySelectorAll<HTMLButtonElement>(".audience-tab").forEach((tab) => {
      listen(tab, "click", () => setAudience(tab.dataset.audience || "adult", true));
    });
    root.querySelectorAll<HTMLButtonElement>(".format-tab").forEach((tab) => {
      listen(tab, "click", () => setFormat(tab.dataset.format || "individual", true));
    });

    const dropdowns = root.querySelectorAll<HTMLElement>("[data-intent-dropdown]");
    const combos = root.querySelectorAll<HTMLElement>(".combo-select[data-combo]");

    const closePanels = () => {
      dropdowns.forEach((field) => {
        field.classList.remove("is-open");
        field.querySelector(".intent-dropdown__trigger")?.setAttribute("aria-expanded", "false");
      });
      combos.forEach((combo) => combo.classList.remove("is-open"));
    };

    dropdowns.forEach((field) => {
      const trigger = field.querySelector<HTMLButtonElement>(".intent-dropdown__trigger");
      const kind = field.dataset.intentDropdown;
      if (!trigger || (kind !== "audience" && kind !== "format")) return;
      listen(trigger, "click", (event) => {
        event.stopPropagation();
        const willOpen = !field.classList.contains("is-open");
        closePanels();
        field.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });
      field.querySelectorAll<HTMLElement>(".combo-option").forEach((opt) => {
        listen(opt, "click", () => {
          if (kind === "audience") setAudience(opt.dataset.value || "adult", true);
          else setFormat(opt.dataset.value || "individual", true);
          field.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    combos.forEach((combo) => {
      const input = combo.querySelector<HTMLInputElement>(".combo-input");
      const menu = combo.querySelector<HTMLElement>(".combo-menu");
      if (!input || !menu) return;
      const kind = combo.dataset.combo;
      const refresh = () => {
        if (kind === "location") renderLocationSuggestions(menu, input.value);
        else renderSportSuggestions(menu, input.value);
      };
      const open = () => {
        dropdowns.forEach((field) => {
          field.classList.remove("is-open");
          field.querySelector(".intent-dropdown__trigger")?.setAttribute("aria-expanded", "false");
        });
        combos.forEach((other) => {
          if (other !== combo) other.classList.remove("is-open");
        });
        refresh();
        combo.classList.add("is-open");
      };
      listen(input, "focus", open);
      listen(input, "input", () => {
        if (input.dataset.syncing === "1") return;
        if (kind === "location") locationTouched.current = true;
        refresh();
        combo.classList.add("is-open");
        publish(kind === "location" ? { location: input.value } : { sport: input.value });
      });
      listen(menu, "click", (event) => {
        const option = (event.target as HTMLElement).closest<HTMLElement>(".combo-option");
        if (!option) return;
        input.value = option.dataset.value || "";
        if (kind === "location") locationTouched.current = true;
        combo.classList.remove("is-open");
        publish(kind === "location" ? { location: input.value } : { sport: input.value });
      });
    });

    listen(document, "click", (event) => {
      if (!root.contains(event.target as Node)) closePanels();
    });

    if (form) {
      listen(form, "submit", (event) => {
        event.preventDefault();
        const nextSport = sportInput?.value.trim() || "";
        const nextLocation = locationInput?.value.trim() || DEFAULT_SEARCH_CITY;
        if (locationInput && !locationInput.value.trim()) locationInput.value = nextLocation;
        void navigate({
          to: "/search",
          search: {
            sport: nextSport,
            location: nextLocation,
            audience: activeAudience,
            format: activeFormat,
          },
        });
      });
    }

    if (!fixedLocation) {
      void resolveSearchCity().then((city) => {
        if (cancelled || locationTouched.current) return;
        writeInput(locationInput, city);
      });
    }
    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [audience, fixedLocation, format, navigate, sport]);

  const cityValue = fixedLocation || DEFAULT_SEARCH_CITY;

  return (
    <div className={`search-block catalog-search search-block--${variant}`} ref={rootRef} data-catalog-search="">
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
      {variant === "hero" ? (
        <div className="search-intent" aria-label="Тип поиска">
          <span className="intent-group">
            <span className="intent-label">Для:</span>
            <button className={`audience-tab${audience === "adult" ? " is-active" : ""}`} type="button" data-audience="adult">
              для себя
            </button>
            <button className={`audience-tab${audience === "child" ? " is-active" : ""}`} type="button" data-audience="child">
              для ребёнка
            </button>
          </span>
          <span className="intent-group">
            <span className="intent-label">Формат:</span>
            <button className={`format-tab${format === "individual" ? " is-active" : ""}`} type="button" data-format="individual">
              индивидуально
            </button>
            <button className={`format-tab${format === "group" ? " is-active" : ""}`} type="button" data-format="group">
              в группе
            </button>
          </span>
        </div>
      ) : null}
      <form className="search-shell" data-search-form={variant}>
        {variant === "header" ? (
          <>
            <div className="search-field intent-select combo-select" data-intent-dropdown="audience">
              <button className="intent-dropdown__trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span className="intent-dropdown__value">{audience === "child" ? "для ребёнка" : "для себя"}</span>
                <Chevron />
              </button>
              <div className="combo-menu" role="listbox" aria-label="Для кого">
                <button className={`combo-option${audience === "adult" ? " is-active" : ""}`} type="button" data-value="adult" data-label="для себя">для себя</button>
                <button className={`combo-option${audience === "child" ? " is-active" : ""}`} type="button" data-value="child" data-label="для ребёнка">для ребёнка</button>
              </div>
            </div>
            <div className="search-field intent-select combo-select" data-intent-dropdown="format">
              <button className="intent-dropdown__trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span className="intent-dropdown__value">{format === "group" ? "в группе" : "индивидуально"}</span>
                <Chevron />
              </button>
              <div className="combo-menu" role="listbox" aria-label="Формат">
                <button className={`combo-option${format === "individual" ? " is-active" : ""}`} type="button" data-value="individual" data-label="индивидуально">индивидуально</button>
                <button className={`combo-option${format === "group" ? " is-active" : ""}`} type="button" data-value="group" data-label="в группе">в группе</button>
              </div>
            </div>
          </>
        ) : null}
        <label className="search-field combo-select" data-combo="sport">
          <span className="search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 19V5h14v14" />
              <path d="M8 16h8" />
              <path d="M8 12h8" />
              <path d="M8 8h4" />
            </svg>
          </span>
          <span className="field-label">Вид спорта</span>
          <input className="combo-input" type="search" name="sport" placeholder="Вид спорта" defaultValue={sport} autoComplete="off" />
          <div className="combo-menu" role="listbox" aria-label="Виды спорта" />
        </label>
        <label className="search-field combo-select" data-combo="location">
          <span className="search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.4" />
            </svg>
          </span>
          <span className="field-label">Город</span>
          <input className="combo-input" type="search" name="location" placeholder="Город" defaultValue={cityValue} autoComplete="off" />
          <div className="combo-menu" role="listbox" aria-label="Города Беларуси" />
        </label>
        <button className="search-submit" type="submit" aria-label="Найти">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
        </button>
      </form>
    </div>
  );
}
