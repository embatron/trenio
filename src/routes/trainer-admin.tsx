import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/trainer-admin")({
  head: () => ({
    meta: [
      { title: "Кабинет тренера — trenio.by" },
      { name: "description", content: "Управляйте профилем тренера, расписанием, заявками и отзывами в личном кабинете trenio.by." },
    ],
  }),
  component: TrainerAdminPage,
});

type TabId = "overview" | "profile" | "schedule" | "requests" | "reviews" | "earnings";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Обзор", icon: "▦" },
  { id: "profile", label: "Профиль", icon: "◉" },
  { id: "schedule", label: "Расписание", icon: "▣" },
  { id: "requests", label: "Заявки", icon: "✎" },
  { id: "reviews", label: "Отзывы", icon: "★" },
  { id: "earnings", label: "Доходы", icon: "₽" },
];

const REQUESTS = [
  { id: 1, name: "Анна Куликова", goal: "Подготовка к полумарафону", time: "ср, 2 июля · 19:00", status: "Новая" },
  { id: 2, name: "Игорь Лысенко", goal: "Силовая, 1 раз/нед", time: "пт, 4 июля · 08:30", status: "Подтверждена" },
  { id: 3, name: "Мария Дроздова", goal: "Стретчинг для офисных", time: "пн, 7 июля · 12:00", status: "Ожидает" },
  { id: 4, name: "Виктор Соловьёв", goal: "Бокс для начинающих", time: "вт, 8 июля · 20:00", status: "Новая" },
];

const SCHEDULE = [
  { day: "Пн", date: "30 июн", slots: [{ time: "07:00", client: "Свободно", kind: "free" }, { time: "10:00", client: "Анна К.", kind: "busy" }] },
  { day: "Вт", date: "1 июл", slots: [{ time: "08:00", client: "Дмитрий Л.", kind: "busy" }, { time: "19:00", client: "Свободно", kind: "free" }] },
  { day: "Ср", date: "2 июл", slots: [{ time: "11:00", client: "Группа · йога", kind: "group" }, { time: "19:00", client: "Анна К.", kind: "busy" }] },
  { day: "Чт", date: "3 июл", slots: [{ time: "Выходной", client: "", kind: "off" }] },
  { day: "Пт", date: "4 июл", slots: [{ time: "08:30", client: "Игорь Л.", kind: "busy" }] },
  { day: "Сб", date: "5 июл", slots: [{ time: "10:00", client: "Группа · бокс", kind: "group" }] },
  { day: "Вс", date: "6 июл", slots: [{ time: "Выходной", client: "", kind: "off" }] },
];

function TrainerAdminPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="admin-page">
      <AdminStyles />
      <SiteHeader />

      <main className="admin-main">
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-id">
              <div className="admin-id__avatar" aria-hidden>ФА</div>
              <div>
                <div className="admin-id__name">Фархад Ахмеджанов</div>
                <div className="admin-id__role">Тренер · BronxGym</div>
              </div>
            </div>

            <nav className="admin-nav">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-nav__item ${tab === t.id ? "is-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="admin-nav__icon" aria-hidden>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>

            <Link to="/trainers/$slug" params={{ slug: "farkhad-akhmedjanov" }} className="admin-public-link">
              Открыть публичный профиль →
            </Link>
          </aside>

          <section className="admin-content">
            <header className="admin-content__head">
              <div>
                <h1 className="admin-h1">{TABS.find((t) => t.id === tab)?.label}</h1>
                <p className="admin-sub">Привет, Фархад. Вот что происходит сегодня.</p>
              </div>
              <div className="admin-quick">
                <button type="button" className="admin-btn admin-btn--ghost">Поделиться профилем</button>
                <button type="button" className="admin-btn">+ Новый слот</button>
              </div>
            </header>

            {tab === "overview" && <OverviewTab />}
            {tab === "profile" && <ProfileTab />}
            {tab === "schedule" && <ScheduleTab />}
            {tab === "requests" && <RequestsTab />}
            {tab === "reviews" && <ReviewsTab />}
            {tab === "earnings" && <EarningsTab />}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="admin-grid">
      <div className="admin-stats">
        {[
          { label: "Заявки за неделю", value: "12", delta: "+3" },
          { label: "Подтверждено", value: "8", delta: "+1" },
          { label: "Заполненность", value: "76%", delta: "+5%" },
          { label: "Рейтинг", value: "4.92", delta: "+0.02" },
        ].map((s) => (
          <div key={s.label} className="admin-stat">
            <div className="admin-stat__value">{s.value}</div>
            <div className="admin-stat__label">{s.label}</div>
            <div className="admin-stat__delta">{s.delta} за неделю</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Новые заявки</h2>
          <span className="admin-badge">{REQUESTS.length}</span>
        </div>
        <div className="admin-list">
          {REQUESTS.slice(0, 3).map((r) => (
            <div key={r.id} className="admin-row">
              <div>
                <div className="admin-row__title">{r.name}</div>
                <div className="admin-row__meta">{r.goal} · {r.time}</div>
              </div>
              <div className="admin-row__actions">
                <button className="admin-btn admin-btn--sm">Принять</button>
                <button className="admin-btn admin-btn--sm admin-btn--ghost">Отклонить</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Ближайшие тренировки</h2>
        </div>
        <div className="admin-list">
          {[
            { t: "Сегодня · 19:00", c: "Анна Куликова", k: "Бег · 60 мин" },
            { t: "Завтра · 08:00", c: "Дмитрий Лосев", k: "Бокс · 90 мин" },
            { t: "Чт · 11:00", c: "Группа (6 чел.)", k: "Йога · 60 мин" },
          ].map((x) => (
            <div key={x.t} className="admin-row">
              <div>
                <div className="admin-row__title">{x.c}</div>
                <div className="admin-row__meta">{x.k}</div>
              </div>
              <div className="admin-row__when">{x.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="admin-card admin-card--padded">
      <div className="admin-profile-head">
        <img src="https://placehold.co/120x120/png?text=Фото" alt="Аватар" className="admin-profile-avatar" />
        <div>
          <button className="admin-btn admin-btn--sm">Загрузить новое фото</button>
          <p className="admin-hint">JPG/PNG, до 5 МБ. Лучше квадратное.</p>
        </div>
      </div>

      <div className="admin-form">
        <label className="admin-field"><span>Имя</span><input defaultValue="Фархад" /></label>
        <label className="admin-field"><span>Фамилия</span><input defaultValue="Ахмеджанов" /></label>
        <label className="admin-field admin-field--full"><span>Заголовок профиля</span><input defaultValue="Тренер по боксу и ОФП · BronxGym" /></label>
        <label className="admin-field admin-field--full">
          <span>О себе</span>
          <textarea rows={5} defaultValue="Мастер спорта по боксу. Готовлю как новичков, так и любителей к соревнованиям. Индивидуальный подход к каждому ученику." />
        </label>
        <label className="admin-field"><span>Цена за тренировку, BYN</span><input type="number" defaultValue={60} /></label>
        <label className="admin-field"><span>Длительность, мин</span><input type="number" defaultValue={60} /></label>
        <label className="admin-field admin-field--full"><span>Виды спорта (через запятую)</span><input defaultValue="Бокс, ОФП, Тайский бокс" /></label>
        <label className="admin-field admin-field--full"><span>Языки</span><input defaultValue="Русский, английский" /></label>
      </div>

      <div className="admin-form__actions">
        <button className="admin-btn admin-btn--ghost">Отменить</button>
        <button className="admin-btn">Сохранить изменения</button>
      </div>
    </div>
  );
}

function ScheduleTab() {
  return (
    <div className="admin-card admin-card--padded">
      <div className="admin-week">
        {SCHEDULE.map((d) => (
          <div key={d.day} className="admin-day">
            <div className="admin-day__head">
              <span className="admin-day__name">{d.day}</span>
              <span className="admin-day__date">{d.date}</span>
            </div>
            <div className="admin-day__slots">
              {d.slots.map((s, i) => (
                <div key={i} className={`admin-slot admin-slot--${s.kind}`}>
                  <strong>{s.time}</strong>
                  {s.client && <span>{s.client}</span>}
                </div>
              ))}
              <button className="admin-slot admin-slot--add">+ слот</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsTab() {
  return (
    <div className="admin-card">
      <div className="admin-list">
        {REQUESTS.map((r) => (
          <div key={r.id} className="admin-row admin-row--lg">
            <div>
              <div className="admin-row__title">{r.name} <span className={`admin-chip admin-chip--${r.status === "Новая" ? "primary" : r.status === "Подтверждена" ? "ok" : "muted"}`}>{r.status}</span></div>
              <div className="admin-row__meta">{r.goal}</div>
              <div className="admin-row__meta">{r.time}</div>
            </div>
            <div className="admin-row__actions">
              <button className="admin-btn admin-btn--sm">Принять</button>
              <button className="admin-btn admin-btn--sm admin-btn--ghost">Написать</button>
              <button className="admin-btn admin-btn--sm admin-btn--ghost">Отклонить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsTab() {
  return (
    <div className="admin-card">
      <div className="admin-list">
        {[
          { n: "Анна К.", r: 5, t: "Очень помог подготовиться к старту. Чёткие планы, поддержка." },
          { n: "Дмитрий Л.", r: 5, t: "Тренировки разные, никогда не скучно. Прогресс заметен через месяц." },
          { n: "Мария Д.", r: 4, t: "Хорошо объясняет технику, но иногда задерживается на 5 минут." },
        ].map((r) => (
          <div key={r.n} className="admin-row admin-row--lg">
            <div>
              <div className="admin-row__title">{r.n} · <span style={{ color: "var(--primary)" }}>{"★".repeat(r.r)}</span></div>
              <div className="admin-row__meta">{r.t}</div>
            </div>
            <div className="admin-row__actions">
              <button className="admin-btn admin-btn--sm admin-btn--ghost">Ответить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningsTab() {
  return (
    <div className="admin-grid">
      <div className="admin-stats">
        {[
          { label: "Этот месяц", value: "1 840 BYN" },
          { label: "Прошлый месяц", value: "1 520 BYN" },
          { label: "Ожидает выплаты", value: "320 BYN" },
        ].map((s) => (
          <div key={s.label} className="admin-stat">
            <div className="admin-stat__value">{s.value}</div>
            <div className="admin-stat__label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <div className="admin-card__head"><h2>Последние операции</h2></div>
        <div className="admin-list">
          {[
            { d: "28 июн", c: "Анна Куликова", a: "+60 BYN" },
            { d: "27 июн", c: "Дмитрий Лосев", a: "+60 BYN" },
            { d: "26 июн", c: "Группа · йога", a: "+180 BYN" },
            { d: "25 июн", c: "Выплата на карту", a: "−400 BYN" },
          ].map((x, i) => (
            <div key={i} className="admin-row">
              <div>
                <div className="admin-row__title">{x.c}</div>
                <div className="admin-row__meta">{x.d}</div>
              </div>
              <div className="admin-row__when" style={{ color: x.a.startsWith("−") ? "var(--muted)" : "var(--primary)" }}>{x.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ADMIN_CSS = `
.admin-page { min-height: 100vh; display: flex; flex-direction: column; background: #f6f6f7; }
.admin-main { flex: 1; padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 64px); }
.admin-shell { max-width: var(--layout-max); margin: 0 auto; display: grid; grid-template-columns: 260px 1fr; gap: 28px; }

.admin-sidebar { background: #fff; border-radius: 22px; padding: 22px; border: 1px solid rgba(var(--dark-rgb), 0.06); align-self: start; position: sticky; top: 100px; }
.admin-id { display: flex; align-items: center; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); margin-bottom: 14px; }
.admin-id__avatar { width: 46px; height: 46px; border-radius: 50%; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); display: grid; place-items: center; font-weight: 900; font-size: 15px; }
.admin-id__name { font-weight: 800; color: var(--dark); letter-spacing: -0.01em; }
.admin-id__role { font-size: 13px; color: var(--muted); }
.admin-nav { display: grid; gap: 4px; }
.admin-nav__item { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; border: 0; background: transparent; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer; text-align: left; }
.admin-nav__item:hover { background: rgba(var(--dark-rgb), 0.04); }
.admin-nav__item.is-active { background: rgba(var(--primary-rgb), 0.10); color: var(--primary-dark); }
.admin-nav__icon { width: 22px; text-align: center; opacity: 0.9; }
.admin-public-link { display: block; margin-top: 18px; padding: 12px; text-align: center; border-radius: 12px; background: rgba(var(--dark-rgb), 0.04); color: var(--text); font-size: 13px; font-weight: 700; text-decoration: none; }
.admin-public-link:hover { background: rgba(var(--dark-rgb), 0.08); }

.admin-content { display: grid; gap: 22px; }
.admin-content__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; flex-wrap: wrap; }
.admin-h1 { margin: 0 0 4px; font-size: 28px; font-weight: 900; color: var(--dark); letter-spacing: -0.03em; }
.admin-sub { margin: 0; color: var(--muted); font-size: 14px; }
.admin-quick { display: flex; gap: 10px; }

.admin-btn { height: 40px; padding: 0 16px; border-radius: 12px; background: var(--primary); color: #fff; border: 0; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.22); transition: background 0.18s ease, transform 0.18s ease; }
.admin-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }
.admin-btn--ghost { background: #fff; color: var(--text); border: 1px solid rgba(var(--dark-rgb), 0.12); box-shadow: none; }
.admin-btn--ghost:hover { background: rgba(var(--dark-rgb), 0.04); color: var(--dark); }
.admin-btn--sm { height: 34px; padding: 0 12px; font-size: 13px; box-shadow: none; }

.admin-grid { display: grid; gap: 22px; }
.admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.admin-stat { background: #fff; border-radius: 18px; padding: 18px; border: 1px solid rgba(var(--dark-rgb), 0.06); }
.admin-stat__value { font-size: 28px; font-weight: 900; color: var(--dark); letter-spacing: -0.03em; }
.admin-stat__label { font-size: 13px; color: var(--muted); font-weight: 600; margin-top: 4px; }
.admin-stat__delta { margin-top: 8px; font-size: 12px; color: var(--primary); font-weight: 700; }

.admin-card { background: #fff; border-radius: 20px; border: 1px solid rgba(var(--dark-rgb), 0.06); overflow: hidden; }
.admin-card--padded { padding: 24px; }
.admin-card__head { padding: 18px 20px; border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.admin-card__head h2 { margin: 0; font-size: 16px; font-weight: 800; color: var(--dark); letter-spacing: -0.01em; }
.admin-badge { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }

.admin-list { display: grid; }
.admin-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); }
.admin-row:last-child { border-bottom: 0; }
.admin-row--lg { padding: 18px 20px; }
.admin-row__title { font-weight: 800; color: var(--dark); letter-spacing: -0.005em; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.admin-row__meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
.admin-row__when { font-size: 13px; color: var(--muted); font-weight: 700; white-space: nowrap; }
.admin-row__actions { display: flex; gap: 8px; flex-wrap: wrap; }

.admin-chip { font-size: 11px; padding: 3px 8px; border-radius: 999px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.admin-chip--primary { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
.admin-chip--ok { background: rgba(34,197,94,0.12); color: rgb(21, 128, 61); }
.admin-chip--muted { background: rgba(var(--dark-rgb), 0.06); color: var(--muted); }

.admin-profile-head { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
.admin-profile-avatar { width: 88px; height: 88px; border-radius: 22px; object-fit: cover; }
.admin-hint { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
.admin-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.admin-field { display: grid; gap: 6px; }
.admin-field--full { grid-column: 1 / -1; }
.admin-field span { font-size: 12px; font-weight: 700; color: var(--text); }
.admin-field input, .admin-field textarea { width: 100%; border-radius: 12px; border: 1px solid rgba(var(--dark-rgb), 0.12); padding: 10px 14px; font-size: 14px; font-family: inherit; color: var(--text); outline: 0; background: #fff; }
.admin-field input { height: 42px; }
.admin-field input:focus, .admin-field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.12); }
.admin-form__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

.admin-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
.admin-day { background: #fafafa; border-radius: 14px; padding: 12px 10px; min-height: 220px; }
.admin-day__head { display: flex; justify-content: space-between; margin-bottom: 10px; }
.admin-day__name { font-weight: 800; color: var(--dark); font-size: 13px; }
.admin-day__date { font-size: 12px; color: var(--muted); }
.admin-day__slots { display: grid; gap: 6px; }
.admin-slot { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; font-size: 12px; line-height: 1.3; text-align: left; border: 0; cursor: pointer; }
.admin-slot strong { font-weight: 800; font-size: 12px; }
.admin-slot--busy { background: rgba(var(--primary-rgb), 0.14); color: var(--primary-dark); }
.admin-slot--free { background: #fff; border: 1px dashed rgba(var(--dark-rgb), 0.18); color: var(--muted); }
.admin-slot--group { background: rgba(99, 102, 241, 0.14); color: rgb(67, 56, 202); }
.admin-slot--off { background: rgba(var(--dark-rgb), 0.06); color: var(--muted); }
.admin-slot--add { background: transparent; border: 1px dashed rgba(var(--dark-rgb), 0.14); color: var(--muted); padding: 6px; font-size: 12px; }
.admin-slot--add:hover { color: var(--primary); border-color: rgba(var(--primary-rgb), 0.4); }

@media (max-width: 960px) {
  .admin-shell { grid-template-columns: 1fr; }
  .admin-sidebar { position: static; }
  .admin-nav { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); grid-auto-flow: column; overflow-x: auto; }
  .admin-week { grid-template-columns: repeat(2, 1fr); }
  .admin-form { grid-template-columns: 1fr; }
}
`;

function AdminStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />;
}
