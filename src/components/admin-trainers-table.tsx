import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { UserAvatar } from "@/components/user-avatar";
import { TrainerName } from "@/components/trainer-name";
import { TablePager, useTablePage } from "@/components/table-pager";
import { TRAINER_PUBLISH_LABEL, type AdminTrainer } from "@/lib/admin/trainers";
import { TrainerNoteCell } from "@/components/admin-trainer-note";
import { issueTrainerInviteFn, markTrainerInviteSentFn } from "@/lib/catalog/trainer-magic";
import { authErrorMessage } from "@/lib/auth/errors";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";
import { TRAINER_AUDIENCE_OPTIONS, TRAINER_FORMAT_OPTIONS, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { getSportTaxonomyChild, getTopLevelSportCategory, listPublishedSportCategories, listSecondLevelSports } from "@/lib/catalog/sport-taxonomy";
import { placeLine } from "@/lib/geo/schemas";

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
const MESSAGE_ICON = "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 6l8 6 8-6";

function addedOn(iso: string) {
  return addedFormat.format(new Date(iso));
}

/** National digits only, for this table: `445326333`. */
function nationalPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("375")) return digits.slice(3);
  if (digits.startsWith("80") && digits.length === 11) return digits.slice(2);
  return digits;
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

function TrainerSocial({ instagram, telegram }: { instagram: string; telegram: string }) {
  const ig = socialHref("instagram", instagram);
  const tg = socialHref("telegram", telegram);
  if (!ig && !tg) return <>—</>;
  return (
    <div className="cabinet-social">
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
    ? "Профиль опубликован, сообщение не отправляется"
    : !ready
      ? "Нет карточки в базе"
      : copied
        ? "Текст скопирован и отмечен отправленным"
        : error
          ? error
          : "Скопировать текст и отметить отправленным";
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
            const ok = await copyText((result as { text: string }).text);
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
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={copied ? CHECK_ICON : MESSAGE_ICON} /></svg>
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
    trainer.inviteSentAt ? "отправлено" : "ожидает",
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

export function AdminTrainersTable({ trainers }: { trainers: AdminTrainer[] }) {
  const [query, setQuery] = useState("");
  const [notePatch, setNotePatch] = useState<Record<string, { body: string; at: string; count: number }>>({});
  const [sentPatch, setSentPatch] = useState<Record<string, string>>({});
  const listed = useMemo(
    () => trainers.map((trainer) => {
      const note = notePatch[trainer.slug];
      const sent = sentPatch[trainer.slug];
      if (!note && !sent) return trainer;
      return {
        ...trainer,
        ...(note ? { staffNote: note.body, staffNoteAt: note.at, staffNoteCount: note.count } : {}),
        ...(sent ? { inviteSentAt: sent } : {}),
      };
    }),
    [trainers, notePatch, sentPatch],
  );
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<"" | TrainerFormat>("");
  const [audience, setAudience] = useState<"" | TrainerAudience>("");
  const [message, setMessage] = useState<"" | "sent" | "unsent">("");
  const [note, setNote] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "reviews" | "rating" | "popularity" | "sent" | "note">("date-desc");
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visible = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е").split(/\s+/).filter(Boolean);
    const rows = listed.filter((trainer) => {
      const parents = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.parentSlug);
      if (category && !parents.includes(category)) return false;
      if (sport && !trainer.sportSlugs.includes(sport)) return false;
      if (city && trainer.city !== city) return false;
      if (format && !trainer.formats.includes(format)) return false;
      if (audience && !trainer.audiences.includes(audience)) return false;
      if (message === "sent" && !trainer.inviteSentAt) return false;
      if (message === "unsent" && trainer.inviteSentAt) return false;
      if (note === "yes" && trainer.staffNoteCount < 1) return false;
      if (note === "no" && trainer.staffNoteCount > 0) return false;
      if (tokens.length) {
        const haystack = searchHaystack(trainer);
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
    const byName = (a: AdminTrainer, b: AdminTrainer) => a.fullName.localeCompare(b.fullName, "ru");
    rows.sort((a, b) => {
      if (sort === "reviews") return b.reviews - a.reviews || byName(a, b);
      if (sort === "rating") return Number(b.rating) - Number(a.rating) || b.reviews - a.reviews || byName(a, b);
      if (sort === "popularity") return b.popularity - a.popularity || byName(a, b);
      if (sort === "sent") {
        const left = a.inviteSentAt ? Date.parse(a.inviteSentAt) : 0;
        const right = b.inviteSentAt ? Date.parse(b.inviteSentAt) : 0;
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
  }, [listed, query, category, sport, city, format, audience, message, note, sort]);
  const pager = useTablePage(visible, `${query}|${category}|${sport}|${city}|${format}|${audience}|${message}|${note}|${sort}`);

  if (listed.length === 0) {
    return <p className="cabinet-empty">Тренеров пока нет.</p>;
  }

  return (
    <>
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
        <label>
          <span>Сообщение</span>
          <select value={message} onChange={(event) => setMessage(event.target.value as "" | "sent" | "unsent")}>
            <option value="">Все</option>
            <option value="sent">Отправлено</option>
            <option value="unsent">Не отправлено</option>
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
            <option value="date-desc">Сначала новые</option>
            <option value="date-asc">Сначала старые</option>
            <option value="reviews">По комментариям</option>
            <option value="rating">По оценке</option>
            <option value="popularity">По рейтингу</option>
            <option value="sent">Сначала отправленные</option>
            <option value="note">Сначала с заметкой</option>
          </select>
        </label>
      </div>
      {visible.length === 0 ? <p className="cabinet-empty">Нет тренеров с таким фильтром.</p> : (
        <>
        <div className="cabinet-table-wrap">
          <table className="cabinet-table cabinet-table--trainers">
            <thead>
              <tr>
                <th>Тренер</th>
                <th>Действия</th>
                <th>Сообщение</th>
                <th>Телефон</th>
                <th>Категория</th>
                <th>С кем</th>
                <th>Город</th>
                <th>Добавлен</th>
                <th>Оценка</th>
                <th>Рейтинг</th>
                <th>Публикация</th>
                <th>Контакты</th>
                <th>Аккаунт</th>
                <th>Заметка</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map((trainer) => (
                <tr key={trainer.slug}>
                  <td>
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
                      <InviteCopy
                        slug={trainer.slug}
                        ready={Boolean(trainer.id)}
                        published={trainer.status === "published"}
                        onSent={(at) => setSentPatch((current) => ({ ...current, [trainer.slug]: at }))}
                      />
                      <a className="cabinet-icon-btn" href={`/admin/trainers/${trainer.slug}`} aria-label="Редактировать" title="Редактировать">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                      </a>
                    </div>
                  </td>
                  <td>
                    {trainer.inviteSentAt ? (
                      <span className="cabinet-mark is-sent" title={dateFormat.format(new Date(trainer.inviteSentAt))} aria-label="Отправлено">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CHECK_ICON} /></svg>
                      </span>
                    ) : (
                      <span className="cabinet-mark is-unsent" aria-label="Не отправлено">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CROSS_ICON} /></svg>
                      </span>
                    )}
                  </td>
                  <td>{nationalPhone(trainer.phone) || "—"}</td>
                  <td>{categoryLabels(trainer.sportSlugs) || "—"}</td>
                  <td className="is-audience">{audienceLabels(trainer.audiences) || "—"}</td>
                  <td>{trainer.city || "—"}</td>
                  <td>{trainer.createdAt ? addedOn(trainer.createdAt) : "—"}</td>
                  <td><TrainerStars rating={trainer.rating} reviews={trainer.reviews} /></td>
                  <td title={`Рейтинг ${trainer.popularity} из 100`}>{Number.isInteger(trainer.popularity) ? trainer.popularity : trainer.popularity.toFixed(1)}</td>
                  <td><span className={`cabinet-status cabinet-status--${trainer.status}`}>{TRAINER_PUBLISH_LABEL[trainer.status]}</span></td>
                  <td><TrainerSocial instagram={trainer.instagram} telegram={trainer.telegram} /></td>
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
    </>
  );
}
