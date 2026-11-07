import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { UserAvatar } from "@/components/user-avatar";
import { TrainerName } from "@/components/trainer-name";
import { TablePager, useTablePage } from "@/components/table-pager";
import { TRAINER_PUBLISH_LABEL, type AdminTrainer } from "@/lib/admin/trainers";
import { TrainerNoteCell } from "@/components/admin-trainer-note";
import { TrainerEditDialog } from "@/components/admin-trainer-page";
import { issueTrainerInviteFn, markTrainerInviteSentFn } from "@/lib/catalog/trainer-magic";
import { authErrorMessage } from "@/lib/auth/errors";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";
import { TRAINER_AUDIENCE_OPTIONS, TRAINER_FORMAT_OPTIONS, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { getSportTaxonomyChild, getTopLevelSportCategory, listPublishedSportCategories, listSecondLevelSports } from "@/lib/catalog/sport-taxonomy";
import { placeLine } from "@/lib/geo/schemas";
import { outreachHello, outreachWithSiteLink } from "@/lib/site-texts/defaults";

const TRAINER_PAGE_SIZE = 20;
type TrainerPublishTab = "unpublished" | "published";
type TrainerSort = "date-desc" | "date-asc" | "reviews" | "rating" | "popularity" | "sent" | "link" | "visit" | "note";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
const addedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Minsk",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const STAR_PATH = "M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z";

const CHECK_ICON = "M5 12l5 5L20 7";
const CROSS_ICON = "M6 6l12 12M18 6L6 18";
const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";
const LINK_LEFT = "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71";
const LINK_RIGHT = "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";
const TEXT_PAGE = "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z";
const TEXT_FOLD = "M14 3v5h5";
const TEXT_LINES = "M8 13h8M8 17h5";
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
        : <path d={ARCHIVE_ICON} />;
  return (
    <span className={`cabinet-mark is-publish is-${status}`} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
    </span>
  );
}

function addedOn(iso: string) {
  return addedFormat.format(new Date(iso));
}

/** Cabinet phone that the owner added and confirmed. The digits stay off the row. */
function confirmedCabinetPhone(trainer: AdminTrainer) {
  const account = trainer.account;
  if (!account?.phone || !account.phoneVerified) return "";
  return formatBelarusPhone(account.phone);
}

function categoryLabels(slugs: string[]) {
  const labels: string[] = [];
  for (const slug of slugs) {
    const parent = getSportTaxonomyChild(slug)?.parentSlug;
    const label = parent ? getTopLevelSportCategory(parent)?.label : "";
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.join(", ");
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

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function InviteCopy({
  slug,
  ready,
  published,
  onSent,
}: {
  slug: string;
  ready: boolean;
  published: boolean;
  onSent: (at: string) => void;
}) {
  const issue = useAuthServerFn(issueTrainerInviteFn);
  const markSent = useAuthServerFn(markTrainerInviteSentFn);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !ready || published;
  const label = published
    ? "Профиль опубликован, ссылка не копируется"
    : !ready
      ? "Нет карточки в базе"
      : copied
        ? "Ссылка скопирована и отмечена отправленной"
        : error
          ? error
          : "Скопировать короткую ссылку и отметить её отправленной";
  return (
    <button
      type="button"
      className={locked ? "cabinet-icon-btn is-inactive" : "cabinet-icon-btn"}
      disabled={locked || pending}
      aria-label={label}
      title={label}
      onClick={() => {
        setPending(true);
        setError(null);
        void issue({ data: { slug } })
          .then(async (result) => {
            const ok = await copyText((result as { url: string }).url);
            if (!ok) {
              setCopied(false);
              setError("Не удалось скопировать");
              return;
            }
            const marked = await markSent({ data: { slug } });
            setCopied(true);
            onSent(marked.inviteSentAt);
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch((err: unknown) => setError(authErrorMessage(err)))
          .finally(() => setPending(false));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {copied ? <path d={CHECK_ICON} /> : <><path d={LINK_LEFT} /><path d={LINK_RIGHT} /></>}
      </svg>
    </button>
  );
}

function fillHello(template: string, firstName: string) {
  return outreachWithSiteLink(template.replaceAll("{hello}", outreachHello(firstName)));
}

function TextCopy({ template, firstName, sent }: { template: string; firstName: string; sent: boolean }) {
  const [copied, setCopied] = useState(false);
  const label = sent
    ? "Приветствие уже отправлено"
    : copied
      ? "Текст скопирован"
      : "Скопировать текст первого сообщения";
  return (
    <button
      type="button"
      className={sent ? "cabinet-icon-btn is-inactive" : "cabinet-icon-btn"}
      disabled={sent}
      aria-label={label}
      title={label}
      onClick={() => {
        void copyText(fillHello(template, firstName)).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {copied ? <path d={CHECK_ICON} /> : <><path d={TEXT_PAGE} /><path d={TEXT_FOLD} /><path d={TEXT_LINES} /></>}
      </svg>
    </button>
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
    trainer.telegram,
    trainer.email,
    trainer.languages,
    trainer.priceFrom ? String(trainer.priceFrom) : "",
    trainer.experienceYears ? String(trainer.experienceYears) : "",
    audienceLabels(trainer.audiences),
    formats.join(" "),
    TRAINER_PUBLISH_LABEL[trainer.status],
    trainer.staffNote,
    trainer.outreachSentAt ? "сообщение отправлено" : "сообщение не отправлено",
    trainer.inviteSentAt ? "ссылка отправлена" : "ссылка не отправлена",
    trainer.doorEnteredAt ? "был заходил" : "не заходил",
    trainer.createdAt ? addedOn(trainer.createdAt) : "",
    trainer.rating,
    String(trainer.reviews),
    String(trainer.popularity),
    account?.name ?? "",
    account?.email ?? "",
    account ? displayAccountLogin(account.email) : "аккаунт не создан",
    account?.phone ?? "",
    account?.phone.replace(/\D/g, "") ?? "",
  ].join(" ").toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function sortTrainers(rows: AdminTrainer[], sort: TrainerSort) {
  const byName = (a: AdminTrainer, b: AdminTrainer) => a.fullName.localeCompare(b.fullName, "ru");
  rows.sort((a, b) => {
    if (sort === "reviews") return b.reviews - a.reviews || byName(a, b);
    if (sort === "rating") return Number(b.rating) - Number(a.rating) || b.reviews - a.reviews || byName(a, b);
    if (sort === "popularity") return b.popularity - a.popularity || byName(a, b);
    if (sort === "sent") {
      const left = a.outreachSentAt ? Date.parse(a.outreachSentAt) : 0;
      const right = b.outreachSentAt ? Date.parse(b.outreachSentAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    if (sort === "link") {
      const left = a.inviteSentAt ? Date.parse(a.inviteSentAt) : 0;
      const right = b.inviteSentAt ? Date.parse(b.inviteSentAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    if (sort === "visit") {
      const left = a.doorEnteredAt ? Date.parse(a.doorEnteredAt) : 0;
      const right = b.doorEnteredAt ? Date.parse(b.doorEnteredAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    if (sort === "note") {
      const left = a.staffNoteAt ? Date.parse(a.staffNoteAt) : 0;
      const right = b.staffNoteAt ? Date.parse(b.staffNoteAt) : 0;
      return (right > 0 ? 1 : 0) - (left > 0 ? 1 : 0) || right - left || byName(a, b);
    }
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (!left && !right) return byName(a, b);
    if (!left) return 1;
    if (!right) return -1;
    return sort === "date-asc" ? left - right : right - left;
  });
  return rows;
}

const SORT_OPTIONS: Array<{ id: TrainerSort; label: string }> = [
  { id: "date-desc", label: "Сначала новые" },
  { id: "date-asc", label: "Сначала старые" },
  { id: "reviews", label: "По комментариям" },
  { id: "rating", label: "По оценке" },
  { id: "popularity", label: "По рейтингу" },
  { id: "sent", label: "Сначала с сообщением" },
  { id: "link", label: "Сначала со ссылкой" },
  { id: "visit", label: "Сначала зашедшие" },
  { id: "note", label: "Сначала с заметкой" },
];

export function AdminTrainersTable({
  trainers,
  outreachText,
  list = "all",
}: {
  trainers: AdminTrainer[];
  outreachText: string;
  list?: "all" | "unsent" | "published";
}) {
  const [query, setQuery] = useState("");
  const [publishTab, setPublishTab] = useState<TrainerPublishTab>("unpublished");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [notePatch, setNotePatch] = useState<Record<string, { body: string; at: string; count: number }>>({});
  const [linkPatch, setLinkPatch] = useState<Record<string, string>>({});
  const listed = useMemo(
    () => {
      const patched = trainers.map((trainer) => {
        const note = notePatch[trainer.slug];
        const link = linkPatch[trainer.slug];
        if (!note && !link) return trainer;
        return {
          ...trainer,
          ...(note ? { staffNote: note.body, staffNoteAt: note.at, staffNoteCount: note.count } : {}),
          ...(link ? { inviteSentAt: link } : {}),
        };
      });
      if (list === "unsent") return patched.filter((trainer) => !trainer.outreachSentAt);
      if (list === "published") return patched.filter((trainer) => trainer.status === "published");
      return patched;
    },
    [trainers, notePatch, linkPatch, list],
  );
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<"" | TrainerFormat>("");
  const [audience, setAudience] = useState<"" | TrainerAudience>("");
  const [message, setMessage] = useState<"" | "sent" | "unsent">("");
  const [link, setLink] = useState<"" | "sent" | "unsent">("");
  const [visit, setVisit] = useState<"" | "yes" | "no">("");
  const [note, setNote] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<TrainerSort>("date-desc");
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visibleBuckets = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е").split(/\s+/).filter(Boolean);
    const rows = listed.filter((trainer) => {
      const parents = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.parentSlug);
      if (category && !parents.includes(category)) return false;
      if (sport && !trainer.sportSlugs.includes(sport)) return false;
      if (city && trainer.city !== city) return false;
      if (format && !trainer.formats.includes(format)) return false;
      if (audience && !trainer.audiences.includes(audience)) return false;
      if (message === "sent" && !trainer.outreachSentAt) return false;
      if (message === "unsent" && trainer.outreachSentAt) return false;
      if (link === "sent" && !trainer.inviteSentAt) return false;
      if (link === "unsent" && trainer.inviteSentAt) return false;
      if (visit === "yes" && !trainer.doorEnteredAt) return false;
      if (visit === "no" && trainer.doorEnteredAt) return false;
      if (note === "yes" && trainer.staffNoteCount < 1) return false;
      if (note === "no" && trainer.staffNoteCount > 0) return false;
      if (tokens.length) {
        const haystack = searchHaystack(trainer);
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
    const unpublished = sortTrainers(rows.filter((trainer) => trainer.status !== "published"), sort);
    const published = sortTrainers(rows.filter((trainer) => trainer.status === "published"), sort);
    return { unpublished, published };
  }, [listed, query, category, sport, city, format, audience, message, link, visit, note, sort]);
  const visible = list === "published"
    ? visibleBuckets.published
    : list === "unsent"
      ? sortTrainers(
          visibleBuckets.unpublished.concat(visibleBuckets.published),
          sort,
        )
      : publishTab === "published"
        ? visibleBuckets.published
        : visibleBuckets.unpublished;
  const pager = useTablePage(
    visible,
    `${query}|${category}|${sport}|${city}|${format}|${audience}|${message}|${link}|${visit}|${note}|${sort}|${publishTab}`,
    TRAINER_PAGE_SIZE,
  );

  if (listed.length === 0) {
    const empty = list === "unsent" && trainers.length > 0
      ? "Заготовок нет: первое сообщение уже отправлено всем тренерам."
      : list === "published" && trainers.length > 0
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
      <div className="cabinet-filters">
        <label className="cabinet-filters__search">
          <span>Поиск</span>
          <input
            type="search"
            value={query}
            placeholder="Имя, телефон, город, спорт, аккаунт, Instagram, заметка"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
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
        {list === "unsent" ? null : (
          <label>
            <span>Сообщение</span>
            <select value={message} onChange={(event) => setMessage(event.target.value as "" | "sent" | "unsent")}>
              <option value="">Все</option>
              <option value="sent">Отправлено</option>
              <option value="unsent">Не отправлено</option>
            </select>
          </label>
        )}
        {list === "published" ? null : (
          <label>
            <span>Ссылка</span>
            <select value={link} onChange={(event) => setLink(event.target.value as "" | "sent" | "unsent")}>
              <option value="">Все</option>
              <option value="sent">Отправлена</option>
              <option value="unsent">Не отправлена</option>
            </select>
          </label>
        )}
        <label>
          <span>Заход</span>
          <select value={visit} onChange={(event) => setVisit(event.target.value as "" | "yes" | "no")}>
            <option value="">Все</option>
            <option value="yes">Был</option>
            <option value="no">Не был</option>
          </select>
        </label>
        <label>
          <span>Заметка</span>
          <select value={note} onChange={(event) => setNote(event.target.value as "" | "yes" | "no")}>
            <option value="">Все</option>
            <option value="yes">Есть</option>
            <option value="no">Нет</option>
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            {SORT_OPTIONS.filter((option) => list !== "unsent" || option.id !== "sent").filter((option) => list !== "published" || option.id !== "link").map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {visible.length === 0 ? <p className="cabinet-empty">Нет тренеров с таким фильтром.</p> : (
        <>
        <div className="cabinet-table-wrap">
          <table className="cabinet-table cabinet-table--trainers">
            <thead>
              <tr>
                <th className="is-index" aria-label="Номер">№</th>
                <th className="is-person">Тренер</th>
                <th>Действия</th>
                <th>Сообщение</th>
                <th>Ссылка</th>
                <th>Заход</th>
                <th>Публикация</th>
                <th>Категория</th>
                <th>С кем</th>
                <th>Город</th>
                <th>Добавлен</th>
                <th>Оценка</th>
                <th>Рейтинг</th>
                <th>Контакты</th>
                <th>Аккаунт</th>
                <th>Заметка</th>
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
                      <TextCopy template={outreachText} firstName={trainer.firstName} sent={Boolean(trainer.outreachSentAt)} />
                      <InviteCopy
                        slug={trainer.slug}
                        ready={Boolean(trainer.id)}
                        published={trainer.status === "published"}
                        onSent={(at) => setLinkPatch((current) => ({ ...current, [trainer.slug]: at }))}
                      />
                      <button type="button" className="cabinet-icon-btn" aria-label="Редактировать" title="Редактировать" onClick={() => setEditSlug(trainer.slug)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                      </button>
                    </div>
                  </td>
                  <td><FlagMark at={trainer.outreachSentAt} sent="Сообщение отправлено" waiting="Сообщение не отправлено" /></td>
                  <td><FlagMark at={trainer.inviteSentAt} sent="Ссылка отправлена" waiting="Ссылка не отправлена" /></td>
                  <td><FlagMark at={trainer.doorEnteredAt} sent="Был по ссылке" waiting="Ещё не заходил" /></td>
                  <td className="is-publish"><PublishMark status={trainer.status} /></td>
                  <td>{categoryLabels(trainer.sportSlugs) || "—"}</td>
                  <td className="is-audience">{audienceLabels(trainer.audiences) || "—"}</td>
                  <td>{trainer.city || "—"}</td>
                  <td>{trainer.createdAt ? addedOn(trainer.createdAt) : "—"}</td>
                  <td><TrainerStars rating={trainer.rating} reviews={trainer.reviews} /></td>
                  <td title={`Рейтинг ${trainer.popularity} из 100`}>{Number.isInteger(trainer.popularity) ? trainer.popularity : trainer.popularity.toFixed(1)}</td>
                  <td><TrainerSocial instagram={trainer.instagram} telegram={trainer.telegram} phone={confirmedCabinetPhone(trainer)} /></td>
                  <td title={trainer.account ? "Аккаунт создан и привязан к карточке" : "В каталоге есть карточка, но пользователь ещё не зарегистрировался и не забрал профиль"}>
                    {trainer.account ? displayAccountLogin(trainer.account.email) : "Аккаунт не создан"}
                  </td>
                  <td className="is-note">
                    {trainer.id ? (
                      <TrainerNoteCell
                        slug={trainer.slug}
                        name={trainer.fullName || trainer.slug}
                        note={trainer.staffNote}
                        count={trainer.staffNoteCount}
                        onSaved={(body, at, count) => setNotePatch((current) => ({ ...current, [trainer.slug]: { body, at, count } }))}
                      />
                    ) : "—"}
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
