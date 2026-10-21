import { useMemo, useState } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { PhotoImage } from "@/components/photo-image";
import { TablePager, useTablePage } from "@/components/table-pager";
import { checkTrainerClaimLinkFn, TRAINER_PUBLISH_LABEL, type AdminTrainer, type ClaimLinkVerdict } from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { BELARUS_CITIES } from "@/lib/catalog/city-taxonomy";
import { TRAINER_AUDIENCE_OPTIONS, TRAINER_FORMAT_OPTIONS, type TrainerAudience, type TrainerFormat } from "@/lib/catalog/published-trainers";
import { getSportTaxonomyChild, getTopLevelSportCategory, listSecondLevelSports, TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
const STAR_PATH = "M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z";

const COPY_ICON = "M9 9h10v10H9zM5 15V5h10";
const CHECK_ICON = "M5 12l5 5L20 7";
const PROFILE_ICON = "M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6";
const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";

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

function shortClaimLabel(claimPath: string) {
  const token = claimPath.split("/").filter(Boolean).at(-1) ?? "";
  return token ? `/claim/${token.slice(0, 6)}…` : "/claim/…";
}

const CLAIM_VERDICT: Record<ClaimLinkVerdict, string> = {
  current: "Актуальна",
  used: "Уже не действует",
  replaced: "В базе другой адрес",
  missing: "Ссылки нет",
};

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

export function AdminClaimLink({
  origin,
  trainer,
}: {
  origin: string;
  trainer: Pick<AdminTrainer, "slug" | "claimPath" | "claimOpen">;
}) {
  const checkLink = useAuthServerFn(checkTrainerClaimLinkFn);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [verdict, setVerdict] = useState<ClaimLinkVerdict | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trainer.claimPath || !trainer.claimOpen) return <>—</>;
  const url = `${origin}${trainer.claimPath}`;
  const state = verdict ?? "current";

  return (
    <div className="cabinet-claim">
      <a className="cabinet-claim__url" href={url} target="_blank" rel="noopener noreferrer" title={url}>{shortClaimLabel(trainer.claimPath)}</a>
      <div className="cabinet-claim__actions">
        <button
          type="button"
          className="cabinet-icon-btn"
          aria-label={copied ? "Скопировано" : "Скопировать ссылку"}
          title={copied ? "Скопировано" : "Скопировать ссылку"}
          onClick={() => {
            void copyText(url).then((ok) => {
              setCopied(ok);
              setError(ok ? null : "Не удалось скопировать");
              if (ok) window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={copied ? CHECK_ICON : COPY_ICON} /></svg>
        </button>
        <button
          type="button"
          className="cabinet-copy"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            void checkLink({ data: { slug: trainer.slug, claimPath: trainer.claimPath } })
              .then((result) => {
                setVerdict(result as ClaimLinkVerdict);
                setChecked(true);
              })
              .catch((err: unknown) => setError(authErrorMessage(err)))
              .finally(() => setPending(false));
          }}
        >
          {pending ? "Проверка…" : "Проверить"}
        </button>
      </div>
      <p className={`cabinet-claim__state${state === "current" ? " is-current" : " is-stale"}`}>
        {checked ? `Проверено: ${CLAIM_VERDICT[state].toLowerCase()}` : CLAIM_VERDICT[state]}
      </p>
      {error ? <p className="cabinet-claim__state is-stale">{error}</p> : null}
    </div>
  );
}

function searchHaystack(trainer: AdminTrainer) {
  const formats = TRAINER_FORMAT_OPTIONS.filter((option) => trainer.formats.includes(option.id)).map((option) => option.label);
  const sports = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.label ?? slug);
  const account = trainer.account;
  return [
    trainer.fullName,
    trainer.slug,
    trainer.headline,
    trainer.bio,
    trainer.about,
    trainer.sports,
    sports.join(" "),
    categoryLabels(trainer.sportSlugs),
    trainer.city,
    trainer.district,
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
    trainer.createdAt ? dateFormat.format(new Date(trainer.createdAt)) : "",
    trainer.rating,
    String(trainer.reviews),
    String(trainer.popularity),
    account?.name ?? "",
    account?.email ?? "",
    account ? displayAccountLogin(account.email) : "не привязан",
    account?.phone ?? "",
    account?.phone.replace(/\D/g, "") ?? "",
  ].join(" ").toLocaleLowerCase("ru").replaceAll("ё", "е");
}

export function AdminTrainersTable({ trainers }: { trainers: AdminTrainer[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<"" | TrainerFormat>("");
  const [audience, setAudience] = useState<"" | TrainerAudience>("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "reviews" | "rating" | "popularity">("date-desc");
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visible = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е").split(/\s+/).filter(Boolean);
    const rows = trainers.filter((trainer) => {
      const parents = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.parentSlug);
      if (category && !parents.includes(category)) return false;
      if (sport && !trainer.sportSlugs.includes(sport)) return false;
      if (city && trainer.city !== city) return false;
      if (format && !trainer.formats.includes(format)) return false;
      if (audience && !trainer.audiences.includes(audience)) return false;
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
      const left = a.createdAt ? Date.parse(a.createdAt) : 0;
      const right = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (!left && !right) return byName(a, b);
      if (!left) return 1;
      if (!right) return -1;
      return sort === "date-asc" ? left - right : right - left;
    });
    return rows;
  }, [trainers, query, category, sport, city, format, audience, sort]);
  const pager = useTablePage(visible, `${query}|${category}|${sport}|${city}|${format}|${audience}|${sort}`);

  if (trainers.length === 0) {
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
            placeholder="Имя, телефон, город, спорт, аккаунт, Instagram"
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
            {TOP_LEVEL_SPORT_CATEGORIES.map((item) => (
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
          <span>Сортировка</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="date-desc">Сначала новые</option>
            <option value="date-asc">Сначала старые</option>
            <option value="reviews">По комментариям</option>
            <option value="rating">По рейтингу</option>
            <option value="popularity">По популярности</option>
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
                <th>Телефон</th>
                <th>Категория</th>
                <th>С кем</th>
                <th>Город</th>
                <th>Добавлен</th>
                <th>Рейтинг</th>
                <th>Популярность</th>
                <th>Публикация</th>
                <th>Контакты</th>
                <th>Аккаунт</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map((trainer) => (
                <tr key={trainer.slug}>
                  <td>
                    <div className="cabinet-person">
                      {trainer.avatarPath ? (
                        <PhotoImage src={trainer.avatarPath} alt="" preset="avatar" />
                      ) : (
                        <span className="cabinet-person__mark" aria-hidden="true">{(trainer.fullName || "?").slice(0, 1)}</span>
                      )}
                      <div className="cabinet-person__text">
                        <strong title={trainer.fullName || trainer.slug}>{trainer.fullName || trainer.slug}</strong>
                        <span className="cabinet-person__meta">{trainer.sports || "вид спорта не указан"}</span>
                      </div>
                      <div className="cabinet-row-actions">
                        {trainer.status === "published" && trainer.catalog ? (
                          <a className="cabinet-icon-btn" href={`/trainers/${trainer.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Перейти в профиль" title="Перейти в профиль">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PROFILE_ICON} /></svg>
                          </a>
                        ) : (
                          <button type="button" className="cabinet-icon-btn" disabled aria-label="Профиль не опубликован" title="Профиль не опубликован">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PROFILE_ICON} /></svg>
                          </button>
                        )}
                        <a className="cabinet-icon-btn" href={`/admin/trainers/${trainer.slug}`} aria-label="Редактировать" title="Редактировать">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                        </a>
                      </div>
                    </div>
                  </td>
                  <td>{trainer.phone || "—"}</td>
                  <td>{categoryLabels(trainer.sportSlugs) || "—"}</td>
                  <td className="is-audience">{audienceLabels(trainer.audiences) || "—"}</td>
                  <td>{trainer.city || "—"}</td>
                  <td>{trainer.createdAt ? dateFormat.format(new Date(trainer.createdAt)) : "—"}</td>
                  <td><TrainerStars rating={trainer.rating} reviews={trainer.reviews} /></td>
                  <td>{Number.isInteger(trainer.popularity) ? trainer.popularity : trainer.popularity.toFixed(1)}</td>
                  <td><span className={`cabinet-status cabinet-status--${trainer.status}`}>{TRAINER_PUBLISH_LABEL[trainer.status]}</span></td>
                  <td><TrainerSocial instagram={trainer.instagram} telegram={trainer.telegram} /></td>
                  <td title={trainer.account ? "Аккаунт привязан, оферта принята" : "Карточка есть в каталоге, но к ней ещё не привязан пользователь"}>
                    {trainer.account ? displayAccountLogin(trainer.account.email) : "не привязан"}
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
