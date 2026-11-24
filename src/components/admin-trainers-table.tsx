import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { CabinetFilterBar } from "@/components/cabinet";
import { STAR_PATH } from "@/components/review-stars";
import { UserAvatar } from "@/components/user-avatar";
import { TrainerName } from "@/components/trainer-name";
import { TablePager, useTablePage } from "@/components/table-pager";
import { confirmedAccountValue } from "@/lib/admin/account-channel";
import { adminSearchTokens } from "@/lib/instagram/account-query";
import { TRAINER_PUBLISH_LABEL, type AdminTrainer } from "@/lib/admin/trainers";
import { TrainerEditDialog } from "@/components/admin-trainer-page";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";
import { TRAINER_AUDIENCE_OPTIONS, TRAINER_FORMAT_OPTIONS, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { getSportTaxonomyChild, getTopLevelSportCategory, listPublishedSportCategories, listSecondLevelSports, trainerSectionBySlug } from "@/lib/catalog/sport-taxonomy";
import { placeLine } from "@/lib/geo/schemas";

const TRAINER_PAGE_SIZE = 20;
type TrainerPublishTab = "unpublished" | "published";
type TrainerSort = "date-desc" | "date-asc" | "reviews" | "rating" | "popularity" | "visit" | "seen";
type TrainerList = "all" | "unvisited" | "published" | "unclear" | "declined";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
const addedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Minsk",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const visitedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Minsk",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const CHECK_ICON = "M5 12l5 5L20 7";
const CROSS_ICON = "M6 6l12 12M18 6L6 18";
const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";
const EYE_ICON = "M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z";
const EYE_OFF_ICON = "M3 4l18 16M9.9 6.2A11 11 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a18 18 0 0 1-3.1 4M6.2 7.1C4 8.6 2.5 11 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8M9.5 9.6a3 3 0 0 0 4.2 4.1";
const CLOCK_ICON = "M12 7.5V12l3 2";
const ARCHIVE_ICON = "M3 5h18v4H3zM5 9v10h14V9M10 13h4";
const PHONE_PATH = "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";

function FlagMark({ at, sent, waiting }: { at: string; sent: string; waiting: string }) {
  if (at) {
    const label = `${sent} ${dateFormat.format(new Date(at))}`;
    return (
      <span className="cabinet-mark is-sent" title={label} aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CHECK_ICON} /></svg>
      </span>
    );
  }
  return (
    <span className="cabinet-mark is-unsent" title={waiting} aria-label={waiting}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CROSS_ICON} /></svg>
    </span>
  );
}

function PublishMark({ status }: { status: AdminTrainer["status"] }) {
  const label = TRAINER_PUBLISH_LABEL[status];
  const icon = status === "published"
    ? <><path d={EYE_ICON} /><circle cx="12" cy="12" r="3" /></>
    : status === "draft"
      ? <><circle cx="12" cy="12" r="8" /><path d={CLOCK_ICON} /></>
      : status === "hidden"
        ? <path d={EYE_OFF_ICON} />
        : status === "declined"
          ? <path d={CROSS_ICON} />
          : <path d={ARCHIVE_ICON} />;
  return (
    <span className={`cabinet-mark is-publish is-${status}`} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
    </span>
  );
}

function listedOn(trainer: AdminTrainer, list: TrainerList) {
  const iso = list === "published" ? (trainer.publishedAt || trainer.createdAt) : trainer.createdAt;
  return iso ? addedOn(iso) : "—";
}

function addedOn(iso: string) {
  return addedFormat.format(new Date(iso));
}

/** Last sign-in, Minsk time, `ДД/ММ/ГГ ЧЧ:ММ`. */
function visitedOn(iso: string) {
  const parts = visitedFormat.formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")}/${pick("month")}/${pick("year")} ${pick("hour")}:${pick("minute")}`;
}

/** Cabinet phone that the owner added and confirmed. The contacts column keeps the digits off the icon. */
function confirmedCabinetPhone(trainer: AdminTrainer) {
  const account = trainer.account;
  if (!account?.phone || !account.phoneVerified) return "";
  return formatBelarusPhone(account.phone);
}

function accountTitle(trainer: AdminTrainer) {
  if (!trainer.account) return "В каталоге есть карточка, но пользователь ещё не зарегистрировался и не забрал профиль";
  const value = confirmedAccountValue(trainer.account);
  if (!value) return "Аккаунт есть, почта и телефон не подтверждены";
  return value;
}

function AccountCell({ trainer }: { trainer: AdminTrainer }) {
  if (!trainer.account) return "Аккаунт не создан";
  return confirmedAccountValue(trainer.account) || "не подтверждён";
}

/** Category filter value for a card with no section in the taxonomy. */
const UNSET_CATEGORY = "__unset";

function categoryParents(slugs: string[]) {
  const parents: string[] = [];
  for (const slug of slugs) {
    const parent = getSportTaxonomyChild(slug)?.parentSlug
      ?? (trainerSectionBySlug(slug) ? slug : "");
    if (parent && !parents.includes(parent)) parents.push(parent);
  }
  return parents;
}

function categoryLabels(slugs: string[]) {
  return categoryParents(slugs)
    .map((parent) => getTopLevelSportCategory(parent)?.label ?? "")
    .filter(Boolean)
    .join(", ");
}

function audienceLabels(audiences: TrainerAudience[]) {
  return TRAINER_AUDIENCE_OPTIONS.filter((option) => audiences.includes(option.id)).map((option) => option.label).join(", ");
}

function socialHref(kind: "instagram" | "telegram", raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  if (kind === "telegram") return `https://t.me/${handle.replace(/^t\.me\//i, "")}`;
  return `https://www.instagram.com/${handle.replace(/^instagram\.com\//i, "")}/`;
}

function TrainerStars({ rating, reviews }: { rating: string; reviews: number }) {
  const value = Number(rating);
  const score = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
  const text = score.toFixed(1);
  const label = reviews > 0 ? `Рейтинг ${text} из 5, отзывов: ${reviews}` : "Отзывов нет";
  return (
    <span className={`cabinet-rating${score > 0 ? "" : " is-empty"}`} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} /></svg>
      <span>{text}</span>
      <span className="cabinet-rating__count">({reviews})</span>
    </span>
  );
}

function TrainerProfileLink({ trainer }: { trainer: AdminTrainer }) {
  const name = trainer.firstName || trainer.lastName ? (
    <TrainerName firstName={trainer.firstName} lastName={trainer.lastName} />
  ) : (
    trainer.slug
  );
  if (!trainer.id) return name;
  const label = trainer.status === "published" ? "Открыть профиль" : "Открыть неопубликованный профиль";
  return (
    <Link
      className="cabinet-trainer-name"
      to="/trainers/$slug"
      params={{ slug: trainer.slug }}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
    >
      {name}
    </Link>
  );
}

function TrainerSocial({ instagram, telegram, phone }: { instagram: string; telegram: string; phone: string }) {
  const ig = socialHref("instagram", instagram);
  const tg = socialHref("telegram", telegram);
  const tel = phone ? `tel:+${phone.replace(/\D/g, "")}` : "";
  if (!ig && !tg && !tel) return <>—</>;
  return (
    <div className="cabinet-social">
      {tel ? (
        <a className="cabinet-social__link cabinet-social__link--line" href={tel} aria-label="Телефон подтверждён" title="Телефон подтверждён">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PHONE_PATH} /></svg>
        </a>
      ) : null}
      {ig ? (
        <a className="cabinet-social__link" href={ig} target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <InstagramIcon />
        </a>
      ) : null}
      {tg ? (
        <a className="cabinet-social__link" href={tg} target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram">
          <TelegramIcon />
        </a>
      ) : null}
    </div>
  );
}

function searchHaystack(trainer: AdminTrainer) {
  const formats = TRAINER_FORMAT_OPTIONS.filter((option) => trainer.formats.includes(option.id)).map((option) => option.label);
  const sports = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.label ?? slug);
  const account = trainer.account;
  return [
    trainer.fullName,
    trainer.firstName,
    trainer.lastName,
    trainer.slug,
    trainer.headline,
    trainer.bio,
    trainer.about,
    trainer.sports,
    sports.join(" "),
    categoryLabels(trainer.sportSlugs),
    trainer.city,
    trainer.district,
    trainer.places.map((place) => placeLine(place)).join(" "),
    trainer.phone,
    trainer.phone.replace(/\D/g, ""),
    trainer.instagram,
    trainer.instagramHandle,
    trainer.instagramHandle ? `@${trainer.instagramHandle}` : "",
    trainer.telegram,
    trainer.email,
    trainer.languages,
    trainer.priceFrom ? String(trainer.priceFrom) : "",
    trainer.experienceYears ? String(trainer.experienceYears) : "",
    audienceLabels(trainer.audiences),
    formats.join(" "),
    TRAINER_PUBLISH_LABEL[trainer.status],
    trainer.outreachSentAt ? "сообщение отправлено" : "сообщение не отправлено",
    trainer.inviteSentAt ? "ссылка отправлена" : "ссылка не отправлена",
    trainer.doorEnteredAt ? "был заходил" : "не заходил",
    trainer.lastLoginAt ? visitedOn(trainer.lastLoginAt) : "",
    trainer.createdAt ? addedOn(trainer.createdAt) : "",
    trainer.publishedAt ? addedOn(trainer.publishedAt) : "",
    trainer.rating,
    String(trainer.reviews),
    String(trainer.popularity),
    account?.name ?? "",
    account?.email ?? "",
    account ? displayAccountLogin(account.email, account.phone) : "аккаунт не создан",
    confirmedAccountValue(account),
    account?.phone ?? "",
    account?.phone.replace(/\D/g, "") ?? "",
  ].join(" ").toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function sortTrainers(rows: AdminTrainer[], sort: TrainerSort, when: "added" | "activated" = "added") {
  const byName = (a: AdminTrainer, b: AdminTrainer) => a.fullName.localeCompare(b.fullName, "ru");
  const stampOf = (row: AdminTrainer) => {
    const iso = when === "activated" ? (row.publishedAt || row.createdAt) : row.createdAt;
    return iso ? Date.parse(iso) : 0;
  };
  rows.sort((a, b) => {
    if (sort === "reviews") return b.reviews - a.reviews || byName(a, b);
    if (sort === "rating") return Number(b.rating) - Number(a.rating) || b.reviews - a.reviews || byName(a, b);
    if (sort === "popularity") return b.popularity - a.popularity || byName(a, b);
    if (sort === "visit") {
      const left = a.doorEnteredAt ? Date.parse(a.doorEnteredAt) : 0;
      const right = b.doorEnteredAt ? Date.parse(b.doorEnteredAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    if (sort === "seen") {
      const left = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0;
      const right = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    const left = stampOf(a);
    const right = stampOf(b);
    if (!left && !right) return byName(a, b);
    if (!left) return 1;
    if (!right) return -1;
    return sort === "date-asc" ? left - right : right - left;
  });
  return rows;
}

function isUnclearTrainer(trainer: AdminTrainer) {
  return trainer.status === "draft" && Boolean(trainer.doorEnteredAt);
}

function isDraftTrainer(trainer: AdminTrainer) {
  return trainer.status === "draft" && !trainer.doorEnteredAt;
}

const SORT_OPTIONS: Array<{ id: TrainerSort; label: string }> = [
  { id: "date-desc", label: "Сначала новые" },
  { id: "date-asc", label: "Сначала старые" },
  { id: "reviews", label: "По комментариям" },
  { id: "rating", label: "По оценке" },
  { id: "popularity", label: "По рейтингу" },
  { id: "visit", label: "Сначала зашедшие" },
  { id: "seen", label: "Сначала недавно на сайте" },
];

export function AdminTrainersTable({
  trainers,
  list = "all",
}: {
  trainers: AdminTrainer[];
  list?: TrainerList;
}) {
  const [query, setQuery] = useState("");
  const [publishTab, setPublishTab] = useState<TrainerPublishTab>("unpublished");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const listed = useMemo(() => {
    if (list === "unvisited") return trainers.filter(isDraftTrainer);
    if (list === "published") return trainers.filter((trainer) => trainer.status === "published");
    if (list === "unclear") return trainers.filter(isUnclearTrainer);
    if (list === "declined") return trainers.filter((trainer) => trainer.status === "declined");
    return trainers;
  }, [trainers, list]);
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<"" | TrainerFormat>("");
  const [audience, setAudience] = useState<"" | TrainerAudience>("");
  const [visit, setVisit] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<TrainerSort>("date-desc");
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visibleBuckets = useMemo(() => {
    const tokens = adminSearchTokens(query);
    const match = (trainer: AdminTrainer) => {
      const parents = categoryParents(trainer.sportSlugs);
      if (category === UNSET_CATEGORY) {
        if (parents.length > 0) return false;
      } else if (category && !parents.includes(category)) return false;
      if (sport && !trainer.sportSlugs.includes(sport)) return false;
      if (city && trainer.city !== city) return false;
      if (format && !trainer.formats.includes(format)) return false;
      if (audience && !trainer.audiences.includes(audience)) return false;
      if (visit === "yes" && !trainer.doorEnteredAt) return false;
      if (visit === "no" && trainer.doorEnteredAt) return false;
      if (tokens.length) {
        const haystack = searchHaystack(trainer);
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    };
    const pageRows = listed.filter(match);
    const rows = tokens.length ? trainers.filter(match) : pageRows;
    const single = list === "unvisited" || list === "unclear" || list === "declined";
    const narrowed = list === "published"
      ? pageRows.filter((trainer) => trainer.status === "published")
      : single
        ? pageRows
        : publishTab === "published"
          ? pageRows.filter((trainer) => trainer.status === "published")
          : pageRows.filter((trainer) => trainer.status !== "published");
    const when = list === "published" ? "activated" : "added";
    const unpublished = sortTrainers(rows.filter((trainer) => trainer.status !== "published"), sort, when);
    const published = sortTrainers(rows.filter((trainer) => trainer.status === "published"), sort, when);
    return {
      unpublished,
      published,
      widened: tokens.length > 0 && rows.length > narrowed.length,
    };
  }, [trainers, listed, list, publishTab, query, category, sport, city, format, audience, visit, sort]);
  const searching = query.trim().length > 0;
  const single = list === "unvisited" || list === "unclear" || list === "declined";
  const visible = searching
    ? sortTrainers(visibleBuckets.unpublished.concat(visibleBuckets.published), sort, list === "published" ? "activated" : "added")
    : list === "published"
      ? visibleBuckets.published
      : single
        ? sortTrainers(
            visibleBuckets.unpublished.concat(visibleBuckets.published),
            sort,
          )
        : publishTab === "published"
          ? visibleBuckets.published
          : visibleBuckets.unpublished;
  const pager = useTablePage(
    visible,
    `${query}|${category}|${sport}|${city}|${format}|${audience}|${visit}|${sort}|${publishTab}`,
    TRAINER_PAGE_SIZE,
  );

  if (trainers.length === 0) {
    return <p className="cabinet-empty">Тренеров пока нет.</p>;
  }
  if (!searching && listed.length === 0) {
    const empty = list === "unvisited"
      ? "Драфтов нет."
      : list === "unclear"
        ? "Таких карточек нет."
        : list === "declined"
          ? "Отказавшихся нет."
          : list === "published"
            ? "Опубликованных карточек нет."
            : "Тренеров пока нет.";
    return <p className="cabinet-empty">{empty}</p>;
  }

  return (
    <>
      {list === "all" ? (
        <div className="cabinet-tabs" role="tablist" aria-label="Публикация">
          <button type="button" role="tab" aria-selected={publishTab === "unpublished"} onClick={() => setPublishTab("unpublished")}>
            {`Неопубликованные (${visibleBuckets.unpublished.length})`}
          </button>
          <button type="button" role="tab" aria-selected={publishTab === "published"} onClick={() => setPublishTab("published")}>
            {`Опубликованные (${visibleBuckets.published.length})`}
          </button>
        </div>
      ) : null}
      <CabinetFilterBar
        search={(
          <label className="cabinet-filters__search">
            <span>Поиск</span>
            <input
              type="search"
              value={query}
              placeholder="Имя, телефон, город, спорт, аккаунт, Instagram"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        active={[category, sport, city, format, audience, visit].filter(Boolean).length + (sort === "date-desc" ? 0 : 1)}
      >
        <label>
          <span>Категория</span>
          <select
            value={category}
            onChange={(event) => {
              const next = event.target.value;
              setCategory(next);
              if (sport && getSportTaxonomyChild(sport)?.parentSlug !== next && next) setSport("");
            }}
          >
            <option value="">Все категории</option>
            <option value={UNSET_CATEGORY}>Не указан</option>
            {listPublishedSportCategories().map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Тип спорта</span>
          <select value={sport} onChange={(event) => setSport(event.target.value)}>
            <option value="">Все типы</option>
            {sportOptions.map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Город</span>
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">Все города</option>
            {BELARUS_CITIES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Тип тренировки</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as "" | TrainerFormat)}>
            <option value="">Все типы</option>
            {TRAINER_FORMAT_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Возраст</span>
          <select value={audience} onChange={(event) => setAudience(event.target.value as "" | TrainerAudience)}>
            <option value="">Любой</option>
            {TRAINER_AUDIENCE_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        {list === "unvisited" || list === "unclear" ? null : (
          <label>
            <span>Заход</span>
            <select value={visit} onChange={(event) => setVisit(event.target.value as "" | "yes" | "no")}>
              <option value="">Все</option>
              <option value="yes">Был</option>
              <option value="no">Не был</option>
            </select>
          </label>
        )}
        <label>
          <span>Сортировка</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            {SORT_OPTIONS.filter((option) => {
              if ((list === "unvisited" || list === "unclear") && option.id === "visit") return false;
              return true;
            }).map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </CabinetFilterBar>
      {visibleBuckets.widened ? (
        <p className="cabinet-note">Запрос нашёл карточки и вне этого списка. Они тоже в таблице. Поиск смотрит и аккаунт Instagram.</p>
      ) : null}
      {visible.length === 0 ? <p className="cabinet-empty">Нет тренеров с таким фильтром.</p> : (
        <>
        <div className="cabinet-table-wrap">
          <table className="cabinet-table cabinet-table--trainers">
            <thead>
              <tr>
                <th className="is-index" aria-label="Номер">№</th>
                <th className="is-person">Тренер</th>
                <th>Действия</th>
                <th>Заход</th>
                <th>Публикация</th>
                <th className="is-contacts">Контакты</th>
                <th>Категория</th>
                <th>С кем</th>
                <th>Город</th>
                <th>{list === "published" ? "Активирован" : "Добавлен"}</th>
                <th>Оценка</th>
                <th>Рейтинг</th>
                <th>Аккаунт</th>
                <th>Посещение</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map((trainer, index) => (
                <tr key={trainer.slug}>
                  <td className="is-index">{pager.from + index}</td>
                  <td className="is-person">
                    <div className="cabinet-person">
                      <UserAvatar name={trainer.fullName || trainer.firstName || trainer.slug} src={trainer.avatarPath} size={44} />
                      <div className="cabinet-person__text">
                        <strong title={trainer.fullName || trainer.slug}>
                          <TrainerProfileLink trainer={trainer} />
                        </strong>
                        <span className="cabinet-person__meta">{trainer.sports || "вид спорта не указан"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="is-actions">
                    <div className="cabinet-row-actions">
                      <button type="button" className="cabinet-icon-btn" aria-label="Редактировать" title="Редактировать" onClick={() => setEditSlug(trainer.slug)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                      </button>
                    </div>
                  </td>
                  <td><FlagMark at={trainer.doorEnteredAt} sent="Был по ссылке" waiting="Ещё не заходил" /></td>
                  <td className="is-publish"><PublishMark status={trainer.status} /></td>
                  <td className="is-contacts"><TrainerSocial instagram={trainer.instagram} telegram={trainer.telegram} phone={confirmedCabinetPhone(trainer)} /></td>
                  <td>{categoryLabels(trainer.sportSlugs) || "—"}</td>
                  <td className="is-audience">{audienceLabels(trainer.audiences) || "—"}</td>
                  <td>{trainer.city || "—"}</td>
                  <td>{listedOn(trainer, list)}</td>
                  <td><TrainerStars rating={trainer.rating} reviews={trainer.reviews} /></td>
                  <td title={`Рейтинг ${trainer.popularity} из 100`}>{Number.isInteger(trainer.popularity) ? trainer.popularity : trainer.popularity.toFixed(1)}</td>
                  <td title={accountTitle(trainer)}>
                    <AccountCell trainer={trainer} />
                  </td>
                  <td title={trainer.lastLoginAt ? `Последнее посещение сайта ${visitedOn(trainer.lastLoginAt)}` : "На сайт ещё не заходил"}>
                    {trainer.lastLoginAt ? visitedOn(trainer.lastLoginAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
        </>
      )}
      {editSlug ? <TrainerEditDialog slug={editSlug} onClose={() => setEditSlug(null)} /> : null}
    </>
  );
}
