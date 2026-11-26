import { useLayoutEffect, useRef, type ReactNode } from "react";

import type { CatalogPulse, CatalogShare } from "@/lib/admin/catalog-pulse";

export function AdminCatalogPulse({ pulse }: { pulse: CatalogPulse }) {
  const days = pulse.days;
  const today = days.at(-1)?.day;
  const rail = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    let held = false;
    const pin = () => {
      if (!held) node.scrollLeft = node.scrollWidth;
    };
    const hold = () => { held = true; };
    node.addEventListener("pointerdown", hold);
    node.addEventListener("wheel", hold, { passive: true });
    pin();
    const frame = requestAnimationFrame(pin);
    const timers = [50, 250, 800].map((delay) => window.setTimeout(pin, delay));
    return () => {
      held = true;
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      node.removeEventListener("pointerdown", hold);
      node.removeEventListener("wheel", hold);
    };
  }, []);

  return (
    <section className="cabinet-card admin-pulse" aria-label="Сводка каталога">
      <h2>Сводка каталога</h2>
      <div className="admin-pulse__body">
        <PulseBlock title="Города опубликованных">
          {pulse.cities.length ? <ShareList rows={pulse.cities} /> : <p className="admin-pulse__empty">Когда карточка выйдет в каталог, здесь появится её город.</p>}
        </PulseBlock>

        <PulseBlock title="Разделы">
          {pulse.sections.length ? <ShareList rows={pulse.sections} /> : <p className="admin-pulse__empty">Когда карточка выйдет в каталог, здесь появится её раздел.</p>}
        </PulseBlock>

        <PulseBlock title="Календарь">
          <div className="admin-pulse__rail" ref={rail}>
            {days.map((day) => (
              <div
                key={day.day}
                className={`admin-day${day.published > 0 ? " is-hot" : ""}${day.day === today ? " is-today" : ""}`}
                aria-label={day.label}
                title={day.label}
              >
                <span className="admin-day__date">{day.date} {day.month}</span>
                <span className="admin-day__week">{day.weekday}</span>
                <strong>{day.published}</strong>
                <span className="admin-day__cap">опубликовано</span>
                <span className="admin-day__added">+{day.added}</span>
                <span className="admin-day__cap">новые</span>
              </div>
            ))}
          </div>
        </PulseBlock>

        <PulseBlock title="Статусы">
          <ShareList rows={pulse.statuses} />
        </PulseBlock>

        <PulseBlock title="Чего не хватает у опубликованных">
          {pulse.gaps.length ? <ShareList rows={pulse.gaps} /> : <p className="admin-pulse__empty">{pulse.publishedTotal ? "Фото, цена, телефон, город, адрес, улица и подтверждённый аккаунт на месте." : "Считать пока некого."}</p>}
        </PulseBlock>
      </div>
    </section>
  );
}

function PulseBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-pulse__block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ShareList({ rows }: { rows: CatalogShare[] }) {
  return (
    <ul className="admin-pulse__shares">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="admin-pulse__label">{row.label}</span>
          <span className="admin-pulse__bar" aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></span>
          <strong>{row.count}</strong>
          <span className="admin-pulse__percent">{row.percent}%</span>
        </li>
      ))}
    </ul>
  );
}
