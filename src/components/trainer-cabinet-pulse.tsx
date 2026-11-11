import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";

import { CabinetMark, CabinetModal, CabinetNotice, type CabinetIcon, type MeSectionPath } from "@/components/cabinet";
import { SiteFaq } from "@/components/site-faq";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { OWN_PROFILE_STATUSES, setOwnTrainerPageStatusFn, type OwnProfileStatus, type OwnTrainerProfile, type PageStatus } from "@/lib/catalog/trainer-own";
import {
  POPULARITY_LIMITS,
  popularityChecklist,
  popularityParts,
  type PopularityChecklist,
  type PopularityParts,
  ratingFor,
  type TrainerRatingSnapshot,
} from "@/lib/catalog/trainer-popularity";
import type { TrainerCabinetPulse, TrainerViewPeriod } from "@/lib/catalog/trainer-views";
import { accountLikeLabel, accountLikeWord } from "@/lib/catalog/account-like-rules";
import { countRu, pluralRu } from "@/lib/ru-plural";

type PulseMode = "day" | "week" | "month";

const PERIOD_COPY: Record<PulseMode, {
  link: string;
  visit: string;
  saved: string;
  shown: string;
  phone: string;
  instagram: string;
  telegram: string;
  message: string;
  same: string;
  against: string;
}> = {
  day: { link: "сутки", visit: "Посещения за сутки", saved: "Сохранения за сутки", shown: "Показы за сутки", phone: "Телефон за сутки", instagram: "Instagram за сутки", telegram: "Telegram за сутки", message: "Сообщения за сутки", same: "как вчера", against: "ко вчерашнему" },
  week: { link: "неделя", visit: "Посещения за неделю", saved: "Сохранения за неделю", shown: "Показы за неделю", phone: "Телефон за неделю", instagram: "Instagram за неделю", telegram: "Telegram за неделю", message: "Сообщения за неделю", same: "как на прошлой неделе", against: "к прошлой неделе" },
  month: { link: "месяц", visit: "Посещения за месяц", saved: "Сохранения за месяц", shown: "Показы за месяц", phone: "Телефон за месяц", instagram: "Instagram за месяц", telegram: "Telegram за месяц", message: "Сообщения за месяц", same: "как в прошлом месяце", against: "к прошлому месяцу" },
};

function periodDelta(period: TrainerViewPeriod, same: string, against: string) {
  const diff = period.current - period.previous;
  if (diff === 0) return { className: "is-flat", text: same };
  const sign = diff > 0 ? "+" : "−";
  return { className: diff > 0 ? "is-up" : "is-down", text: `${sign}${Math.abs(diff)} ${against}` };
}

function StatMark({ children }: { children: ReactNode }) {
  return <span className="cabinet-stat__mark" aria-hidden="true"><svg viewBox="0 0 24 24">{children}</svg></span>;
}

function PeriodSwitch({
  value,
  label,
  onChange,
}: {
  value: PulseMode;
  label: string;
  onChange: (mode: PulseMode) => void;
}) {
  return (
    <div className="cabinet-stat__switch" role="group" aria-label={label}>
      {(Object.keys(PERIOD_COPY) as PulseMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          className={value === mode ? "is-current" : undefined}
          onClick={() => onChange(mode)}
        >
          {PERIOD_COPY[mode].link}
        </button>
      ))}
    </div>
  );
}

function Figure({
  value,
  label,
  period,
  same,
  against,
  note,
}: {
  value: number;
  label: string;
  period: TrainerViewPeriod;
  same: string;
  against: string;
  note?: string;
}) {
  const delta = periodDelta(period, same, against);
  return (
    <div className="cabinet-stat__figure">
      <strong>{value}</strong>
      <span>{label}</span>
      <span className={`cabinet-stat__delta ${delta.className}`}>{delta.text}</span>
      {note ? <span className="cabinet-stat__note">{note}</span> : null}
    </div>
  );
}

function points(count: number) {
  return countRu(count, "балл", "балла", "баллов");
}

function checklistFor(trainer: OwnTrainerProfile | null): PopularityChecklist | null {
  if (!trainer) return null;
  return popularityChecklist({
    photo: trainer.avatarPath,
    photos: trainer.photos,
    bio: trainer.bio,
    about: trainer.about,
    sports: trainer.sportSlugs,
    experience: trainer.experienceYears,
    price: trainer.priceFrom,
    formats: trainer.formats,
    city: trainer.city,
    places: trainer.places,
    certificates: trainer.certificates,
    phone: trainer.phone,
    instagram: trainer.instagram,
    telegram: trainer.telegram,
    email: trainer.email,
  });
}

const PAGE_STATUS_LABEL: Record<PageStatus, string> = {
  draft: "Не опубликована",
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "Снята с публикации",
};

const PAGE_MODE_LABEL: Record<OwnProfileStatus, string> = {
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "Снята с публикации",
};

export function PageStatusCard({ status }: { status: PageStatus }) {
  const router = useRouter();
  const saveStatus = useAuthServerFn(setOwnTrainerPageStatusFn);
  const [pending, setPending] = useState(false);
  const [asked, setAsked] = useState<OwnProfileStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!asked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setAsked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asked, pending]);
  function ask(next: OwnProfileStatus) {
    if (pending || next === status) return;
    setAsked(next);
  }
  function apply() {
    if (!asked || pending) return;
    const next = asked;
    setPending(true);
    setError("");
    void saveStatus({ data: { status: next } })
      .then(() => {
        setAsked(null);
        return router.invalidate();
      })
      .catch((err: unknown) => setError(authErrorMessage(err) || "Не удалось сменить статус страницы."))
      .finally(() => setPending(false));
  }
  return (
    <article className="cabinet-card" id="trainer-page-status">
      <div className="cabinet-page-status">
        <h2>Страница</h2>
        <span className={`cabinet-status cabinet-status--${status}`}>{PAGE_STATUS_LABEL[status]}</span>
      </div>
      <fieldset className="publish-pick" disabled={pending}>
        <legend>Режим страницы</legend>
        <div className="publish-pick__row" role="group" aria-label="Режим страницы">
          {OWN_PROFILE_STATUSES.map((mode) => {
            const on = status === mode;
            return (
              <label key={mode} className={`publish-pick__option is-${mode}${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => ask(mode)} />
                <span className="publish-pick__box" aria-hidden="true" />
                <span>{PAGE_MODE_LABEL[mode]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {asked ? (
        <CabinetModal onClick={() => { if (!pending) setAsked(null); }}>
          <div className="cabinet-modal__card" role="dialog" aria-modal="true" aria-labelledby="page-status-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="page-status-title">Сохранить статус?</h2>
            <p>Страница станет «{PAGE_MODE_LABEL[asked]}». В каталоге она {asked === "published" ? "будет видна" : "не будет видна"}.</p>
            <div className="cabinet-modal__actions">
              <button type="button" onClick={apply} disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button>
              <button type="button" className="cabinet-form__ghost" onClick={() => setAsked(null)} disabled={pending}>Отмена</button>
            </div>
          </div>
        </CabinetModal>
      ) : null}
      {error ? <CabinetNotice title="Не получилось" message={error} onClose={() => setError("")} /> : null}
    </article>
  );
}

const PERIOD_SPAN: Record<PulseMode, string> = { day: "сутки", week: "неделю", month: "месяц" };

function likeLabel(count: number, mode: PulseMode) {
  return `${accountLikeWord(count)} за ${PERIOD_SPAN[mode]}`;
}

function likeWeightDetail(shown: number, weight: number) {
  const label = accountLikeLabel(shown);
  if (shown <= 0) return "Пока нет лайкосов";
  if (weight + 0.01 < shown) return `${label}. Лайкосы старше полугода дают меньше баллов`;
  return `${label}. Старые лайкосы со временем дают меньше баллов`;
}

function responseDetail(rating: TrainerRatingSnapshot) {
  const line = `За 90 дней: ${countRu(rating.opens, "открытие", "открытия", "открытий")} и ${countRu(rating.engagedRaw, "отклик", "отклика", "откликов")}`;
  if (!rating.coldStart) return line;
  return `${line}. Для новой карточки недостающие дни считаются по среднему каталога`;
}

function RatingDialog({
  parts,
  rating,
  checklist,
  onClose,
}: {
  parts: PopularityParts;
  rating: TrainerRatingSnapshot;
  checklist: PopularityChecklist;
  onClose: () => void;
}) {
  const limits = POPULARITY_LIMITS;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows: Array<{
    title: string;
    icon: CabinetIcon;
    points: number;
    max: number;
    detail: string;
  }> = [
    {
      title: "Карточка",
      icon: "profile",
      points: parts.card,
      max: limits.card,
      detail: checklist.card === limits.cardFields
        ? `Заполнены все 10 основных пунктов — это ${limits.card} баллов`
        : `Заполнено ${checklist.card} из ${limits.cardFields} основных пунктов. За полную карточку — ${limits.card} баллов`,
    },
    {
      title: "Контакты",
      icon: "contacts",
      points: parts.contacts,
      max: limits.contacts,
      detail: checklist.contacts === limits.contactFields
        ? `Добавлены все 4 способа связи — это ${limits.contacts} баллов`
        : `Добавлено ${checklist.contacts} из ${limits.contactFields} способов связи. Один контакт даёт 2 балла, все четыре — 5`,
    },
    {
      title: "Оценка",
      icon: "stats",
      points: parts.rating,
      max: limits.rating,
      detail: rating.reviews > 0
        ? `Средняя — ${rating.rating} из 5 по ${countRu(rating.reviews, "опубликованному отзыву", "опубликованным отзывам", "опубликованным отзывам")}. Оценки 1–3 могут уменьшить эту часть`
        : "Пока нет опубликованных оценок",
    },
    {
      title: "Отзывы",
      icon: "reviews",
      points: parts.reviews,
      max: limits.reviews,
      detail: rating.positiveReviews > 0
        ? `${countRu(rating.positiveReviews, "отзыв с оценкой 4–5", "отзыва с оценкой 4–5", "отзывов с оценкой 4–5")} из ${rating.reviews}. Максимум — после 20 положительных отзывов`
        : rating.reviews > 0
          ? `${countRu(rating.reviews, "опубликованный отзыв", "опубликованных отзыва", "опубликованных отзывов")}. Оценки 1–3 не добавляют баллы за количество`
          : "Пока нет опубликованных отзывов",
    },
    {
      title: "Свежие отзывы",
      icon: "reviews",
      points: parts.recentReviews,
      max: limits.recentReviews,
      detail: rating.recentPositiveReviews > 0
        ? `${countRu(rating.recentPositiveReviews, "положительный отзыв", "положительных отзыва", "положительных отзывов")} за последние ${limits.recentReviewDays} дней. Максимум — 3 балла после 5 отзывов`
        : `За последние ${limits.recentReviewDays} дней положительных отзывов не было. Старые отзывы всё равно учитываются`,
    },
    {
      title: "Отклик",
      icon: "messages",
      points: parts.views,
      max: limits.views,
      detail: `${responseDetail(rating)}. Само открытие баллов не даёт — нужен переход к контакту, сообщение или отзыв`,
    },
    {
      title: "Избранное",
      icon: "favorites",
      points: parts.saves,
      max: limits.saves,
      detail: rating.saves > 0
        ? `${countRu(rating.saves, "человек сохранил", "человека сохранили", "человек сохранили")} карточку. Максимум — 4 балла после 5 сохранений`
        : "Карточку пока не сохраняли. Максимум — после 5 сохранений",
    },
    {
      title: "Лайкосы",
      icon: "likes",
      points: parts.likes,
      max: limits.likes,
      detail: likeWeightDetail(rating.likesShown, rating.likes),
    },
    {
      title: "Свежие лайкосы",
      icon: "likes",
      points: parts.likePace,
      max: limits.likePace,
      detail: rating.likePaceRaw > 0
        ? `${accountLikeLabel(rating.likePaceRaw)} за последние 20 дней. Максимум — 9 баллов после 12 лайкосов`
        : "За последние 20 дней лайкосов не было. Максимум — после 12 лайкосов",
    },
  ];
  return (
    <CabinetModal onClick={onClose}>
      <div className="cabinet-modal__card cabinet-modal__card--rating" role="dialog" aria-modal="true" aria-labelledby="rating-parts-title" aria-describedby="rating-parts-description" onClick={(event) => event.stopPropagation()}>
        <h2 id="rating-parts-title">Как работает рейтинг</h2>
        <p className="cabinet-rating-total">
          <strong>{parts.total}</strong>
          <span>из <b>100</b></span>
        </p>
        <p id="rating-parts-description">Это не только средняя оценка. Рейтинг показывает текущее состояние карточки и помогает определить её место при сортировке «По рейтингу».</p>
        <table className="cabinet-rating-parts">
          <thead className="sr-only">
            <tr>
              <th>Часть рейтинга</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
          {rows.map((row) => (
            <tr key={row.title}>
              <th scope="row">
                <CabinetMark icon={row.icon} />
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.detail}</small>
                </span>
              </th>
              <td>
                <span className="cabinet-rating-parts__score">
                  {points(row.points)} из <b>{row.max}</b>
                </span>
                <span
                  className="cabinet-rating-parts__progress"
                  role="progressbar"
                  aria-label={`${row.title}: ${row.points} из ${row.max}`}
                  aria-valuemin={0}
                  aria-valuemax={row.max}
                  aria-valuenow={row.points}
                >
                  <span style={{ width: `${Math.min(100, Math.max(0, (row.points / row.max) * 100))}%` }} />
                </span>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </CabinetModal>
  );
}

type PulseProps = {
  trainer: OwnTrainerProfile | null;
  views: TrainerCabinetPulse | null;
  ratings: Record<string, TrainerRatingSnapshot>;
};

function usePulseScore(trainer: OwnTrainerProfile | null, _views: TrainerCabinetPulse | null, ratings: Record<string, TrainerRatingSnapshot>) {
  const hasProfile = Boolean(trainer?.slug);
  const rating = hasProfile && trainer ? ratingFor(trainer.slug, ratings) : null;
  const checklist = checklistFor(trainer);
  const parts = rating
    ? popularityParts({
      ...rating,
      cardFilled: checklist?.card ?? 0,
      contactsFilled: checklist?.contacts ?? 0,
    })
    : null;
  return { hasProfile, rating, checklist, parts };
}

type OverviewTone = "coral" | "aqua" | "gold" | "violet" | "green" | "blue";

type OverviewTile = {
  title: string;
  value: number | string;
  detail: string;
  icon: CabinetIcon;
  tone: OverviewTone;
  to: MeSectionPath;
};

function ratingLevel(score: number) {
  const levels = [
    { at: 0, label: "Старт", text: "Карточка только начинает набирать вес." },
    { at: 10, label: "Первый шаг", text: "Появились первые сигналы от клиентов." },
    { at: 20, label: "Набираете темп", text: "Карточку начинают замечать чаще." },
    { at: 30, label: "Хорошее начало", text: "Профиль становится убедительнее." },
    { at: 40, label: "Хороший разгон", text: "Карточка уверенно набирает вес." },
    { at: 50, label: "Уверенный рост", text: "Клиенты регулярно взаимодействуют с профилем." },
    { at: 60, label: "Сильная позиция", text: "Карточка хорошо заметна в каталоге." },
    { at: 70, label: "Высокий интерес", text: "Профиль получает устойчивое внимание." },
    { at: 80, label: "Лидерская группа", text: "Вы среди самых заметных тренеров." },
    { at: 90, label: "Лидер каталога", text: "Карточка близка к максимальному результату." },
  ];
  let index = 0;
  for (let candidate = 1; candidate < levels.length; candidate += 1) {
    if (score < levels[candidate].at) break;
    index = candidate;
  }
  const current = levels[index];
  const next = levels[index + 1];
  return {
    index: index + 1,
    label: current.label,
    text: current.text,
    next: next
      ? `До следующего уровня — ${countRu(next.at - score, "балл", "балла", "баллов")}`
      : score < 100
        ? `До максимума — ${countRu(100 - score, "балл", "балла", "баллов")}`
        : "Максимальный рейтинг — 100",
  };
}

function OverviewTileLink({ tile }: { tile: OverviewTile }) {
  return (
    <Link className={`cabinet-overview-tile is-${tile.tone}`} to={tile.to} reloadDocument>
      <span className="cabinet-overview-tile__top">
        <span>{tile.title}</span>
        <CabinetMark icon={tile.icon} />
      </span>
      <strong>{tile.value}</strong>
      <span className="cabinet-overview-tile__detail">{tile.detail}</span>
      <span className="cabinet-overview-tile__action">
        Открыть раздел
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export function TrainerOverviewRating({ trainer, views, ratings }: PulseProps) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const { hasProfile, rating, checklist, parts } = usePulseScore(trainer, views, ratings);
  if (!hasProfile || !views) return <p className="cabinet-empty">Карточка ещё не привязана.</p>;
  const score = parts?.total ?? 0;
  const level = ratingLevel(score);
  const previousLikes = views.likes.week.previous;
  const previousVisits = views.visits.week.previous;
  const previousSaves = views.favorites.week.previous;
  const previousMessages = views.contacts.message.week.previous;
  const tiles: OverviewTile[] = [
    {
      title: "Лайкосы",
      value: previousLikes,
      detail: `${pluralRu(previousLikes, "лайкос", "лайкоса", "лайкосов")} за прошлую неделю`,
      icon: "likes",
      tone: "coral",
      to: "/me/likes",
    },
    {
      title: "Посещения",
      value: previousVisits,
      detail: `${pluralRu(previousVisits, "открытие", "открытия", "открытий")} страницы за прошлую неделю`,
      icon: "stats",
      tone: "aqua",
      to: "/me/stats",
    },
    {
      title: "Сохранения",
      value: previousSaves,
      detail: `${pluralRu(previousSaves, "сохранение", "сохранения", "сохранений")} карточки за прошлую неделю`,
      icon: "favorites",
      tone: "gold",
      to: "/me/favorites",
    },
    {
      title: "Отзывы",
      value: rating?.reviews ?? 0,
      detail: `${pluralRu(rating?.reviews ?? 0, "опубликованный отзыв", "опубликованных отзыва", "опубликованных отзывов")} сейчас`,
      icon: "reviews",
      tone: "violet",
      to: "/me/reviews",
    },
    {
      title: "Сообщения",
      value: previousMessages,
      detail: `${pluralRu(previousMessages, "переход", "перехода", "переходов")} в сообщения за прошлую неделю`,
      icon: "messages",
      tone: "green",
      to: "/me/messages",
    },
    {
      title: "Карточка",
      value: `${checklist?.card ?? 0}/${POPULARITY_LIMITS.cardFields}`,
      detail: "пунктов профиля заполнено",
      icon: "trainers",
      tone: "blue",
      to: "/me/profile",
    },
  ];
  return (
    <>
      <section className="cabinet-overview" aria-label="Главные показатели">
        <article className="cabinet-overview-rating">
          <span className="cabinet-overview-rating__mark" aria-hidden="true">
            <CabinetMark icon="stats" />
          </span>
          <span className="cabinet-overview-rating__eyebrow">Рейтинг вашего профиля</span>
          <Link className="cabinet-overview-rating__score" to="/me/stats" reloadDocument aria-label={`Рейтинг ${score} из 100. Открыть статистику`}>
            <strong>{score}</strong>
            <span>из 100</span>
          </Link>
          <div className="cabinet-overview-rating__level">
            <span className="cabinet-overview-rating__step">Уровень {level.index} из 10</span>
            <strong>{level.label}</strong>
            <span className="cabinet-overview-rating__level-text">{level.text}</span>
            <span className="cabinet-overview-rating__next">{level.next}</span>
          </div>
          <div
            className="cabinet-overview-rating__progress"
            role="progressbar"
            aria-label="Рейтинг вашего профиля"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
          >
            <span style={{ width: `${score}%` }} />
          </div>
          <div className="cabinet-overview-rating__actions">
            <Link to="/me/stats" reloadDocument>Вся статистика</Link>
            <button type="button" onClick={() => setRatingOpen(true)} aria-haspopup="dialog">
              Как работает рейтинг?
            </button>
          </div>
        </article>
        <div className="cabinet-overview-tiles">
          {tiles.map((tile) => <OverviewTileLink key={tile.title} tile={tile} />)}
        </div>
      </section>
      <section className="cabinet-faq" aria-labelledby="overview-faq">
        <h2 id="overview-faq">Частые вопросы о рейтинге</h2>
        <SiteFaq
          items={[
            {
              q: "Рейтинг и средняя оценка — это одно и то же?",
              a: "Нет. Средняя оценка — это звёзды из отзывов. Рейтинг — общий результат от 0 до 100: он учитывает отзывы, заполненность карточки, отклики, сохранения и лайкосы.",
            },
            {
              q: "Где используется рейтинг и кто его видит?",
              a: "Рейтинг помогает определить порядок карточек при сортировке «По рейтингу». Клиенты видят число рейтинга на карточке, звёзды и отзывы. Подробную таблицу с баллами видите только вы в кабинете.",
            },
            {
              q: "Из чего складываются 100 баллов?",
              a: "До 23 баллов дают заполненная карточка и контакты. До 46 — оценки и положительные отзывы. Ещё до 31 — отклики, сохранения и лайкосы. Поэтому одно действие не может само поднять карточку на вершину.",
            },
            {
              q: "Какие отзывы участвуют в расчёте?",
              a: "Только опубликованные после проверки. Все оценки участвуют в средней. Отзывы на 4–5 звёзд дополнительно дают баллы за количество, а свежие положительные отзывы — небольшой бонус.",
            },
            {
              q: "Почему одна пятёрка не даёт максимальную оценку?",
              a: "Один отзыв ещё не показывает устойчивое качество. Поэтому первая пятёрка влияет осторожно. Чем больше опубликованных отзывов, тем больше система доверяет вашей реальной средней оценке.",
            },
            {
              q: "Что происходит с оценками от 1 до 3?",
              a: "Они не дают баллы за количество положительных отзывов и снижают среднюю оценку. Отдельного резкого штрафа за одну низкую оценку нет, поэтому единичный отзыв не должен обрушить весь рейтинг.",
            },
            {
              q: "Старые отзывы перестают учитываться?",
              a: "Нет. Они всегда остаются в средней оценке и общем числе положительных отзывов. Только небольшой бонус за свежесть — до 3 баллов — получают отзывы на 4–5 звёзд за последние 180 дней.",
            },
            {
              q: "Что такое отклик?",
              a: "Это полезное действие после просмотра страницы: переход к контакту, сообщение или новый отзыв. Само открытие страницы баллов не даёт. Важно, что человек заинтересовался и сделал следующий шаг.",
            },
            {
              q: "Как считаются лайкосы и сохранения?",
              a: "Один аккаунт может поставить карточке только один лайкос и один раз сохранить её. Свой лайкос тренера не учитывается. Лайкосы за последние 20 дней дают отдельный бонус, а лайкосы старше полугода остаются, но весят вдвое меньше.",
            },
            {
              q: "Как новая карточка может конкурировать со старыми?",
              a: "Первые 60 дней новой карточке помогает мягкий старт: в короткой истории откликов и свежих лайкосов недостающие дни временно считаются по среднему каталога. Затем учитываются только реальные действия клиентов.",
            },
            {
              q: "За какой период показаны цифры в цветных плитках?",
              a: "Лайкосы, посещения, сохранения и переходы в сообщения показаны за прошлую полную неделю — с понедельника по воскресенье. Отзывы показывают текущее число опубликованных отзывов, а карточка — сколько основных пунктов профиля заполнено.",
            },
            {
              q: "Как часто обновляются показатели?",
              a: "Новые лайкосы, отзывы, сохранения и переходы обычно появляются сразу после действия или обновления страницы. Плитки за прошлую неделю меняются по понедельникам. Отклики за 90 дней, свежие лайкосы за 20 дней и свежие отзывы за 180 дней пересчитываются каждый день.",
            },
            {
              q: "Почему рейтинг может уменьшиться?",
              a: "Рейтинг показывает текущее состояние, а не копится навсегда. Он может снизиться из-за новой низкой оценки, выхода действия из периода 20, 90 или 180 дней, снятого лайкоса или сохранения, старения лайкоса либо удаления заполненного пункта карточки.",
            },
            {
              q: "Как честно поднять рейтинг?",
              a: "Заполните карточку, добавьте удобные способы связи и просите реальных клиентов оставлять честные отзывы. Регулярный интерес клиентов полезнее разового всплеска: отвечайте на сообщения и поддерживайте страницу актуальной.",
            },
          ]}
        />
      </section>
      {ratingOpen && parts && rating && checklist ? (
        <RatingDialog
          parts={parts}
          rating={rating}
          checklist={checklist}
          onClose={() => setRatingOpen(false)}
        />
      ) : null}
    </>
  );
}

export function TrainerOwnStats({ trainer, views, ratings }: PulseProps) {
  const [visitMode, setVisitMode] = useState<PulseMode>("day");
  const [showMode, setShowMode] = useState<PulseMode>("day");
  const [likeMode, setLikeMode] = useState<PulseMode>("day");
  const [contactMode, setContactMode] = useState<PulseMode>("day");
  const { hasProfile } = usePulseScore(trainer, views, ratings);

  return (
    <>
      {hasProfile && views ? (
        <div className="cabinet-stats cabinet-stats--pulse">
          <div className="cabinet-stat cabinet-stat--visits">
            <StatMark>
              <circle cx="12" cy="12" r="3.2" />
              <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
            </StatMark>
            <PeriodSwitch value={visitMode} label="Период посещений" onChange={setVisitMode} />
            <Figure
              value={views.visits[visitMode].current}
              label={PERIOD_COPY[visitMode].visit}
              period={views.visits[visitMode]}
              same={PERIOD_COPY[visitMode].same}
              against={PERIOD_COPY[visitMode].against}
            />
            <Figure
              value={views.favorites[visitMode].current}
              label={PERIOD_COPY[visitMode].saved}
              period={views.favorites[visitMode]}
              same={PERIOD_COPY[visitMode].same}
              against={PERIOD_COPY[visitMode].against}
              note={`сейчас в избранном у ${countRu(views.favorites.total, "человека", "человек", "человек")}`}
            />
          </div>
          <div className="cabinet-stat cabinet-stat--shows">
            <StatMark>
              <rect x="7" y="3" width="14" height="12" rx="2" />
              <path d="M3 7v12a2 2 0 0 0 2 2h12" />
            </StatMark>
            <PeriodSwitch value={showMode} label="Период показов" onChange={setShowMode} />
            <Figure
              value={views.impressions[showMode].current}
              label={PERIOD_COPY[showMode].shown}
              period={views.impressions[showMode]}
              same={PERIOD_COPY[showMode].same}
              against={PERIOD_COPY[showMode].against}
            />
          </div>
          <div className="cabinet-stat cabinet-stat--likes">
            <StatMark>
              <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </StatMark>
            <PeriodSwitch value={likeMode} label="Период лайкосов" onChange={setLikeMode} />
            <Figure
              value={views.likes[likeMode].current}
              label={likeLabel(views.likes[likeMode].current, likeMode)}
              period={views.likes[likeMode]}
              same={PERIOD_COPY[likeMode].same}
              against={PERIOD_COPY[likeMode].against}
              note={`всего ${accountLikeLabel(views.likes.total)}`}
            />
          </div>
          <div className="cabinet-stat cabinet-stat--contacts">
            <StatMark>
              <path d="M14 5h5v5" />
              <path d="M19 5l-8 8" />
              <path d="M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" />
            </StatMark>
            <PeriodSwitch value={contactMode} label="Период переходов" onChange={setContactMode} />
            <Figure
              value={views.contacts.phone[contactMode].current}
              label={PERIOD_COPY[contactMode].phone}
              period={views.contacts.phone[contactMode]}
              same={PERIOD_COPY[contactMode].same}
              against={PERIOD_COPY[contactMode].against}
            />
            <Figure
              value={views.contacts.instagram[contactMode].current}
              label={PERIOD_COPY[contactMode].instagram}
              period={views.contacts.instagram[contactMode]}
              same={PERIOD_COPY[contactMode].same}
              against={PERIOD_COPY[contactMode].against}
            />
            <Figure
              value={views.contacts.telegram[contactMode].current}
              label={PERIOD_COPY[contactMode].telegram}
              period={views.contacts.telegram[contactMode]}
              same={PERIOD_COPY[contactMode].same}
              against={PERIOD_COPY[contactMode].against}
            />
            <Figure
              value={views.contacts.message[contactMode].current}
              label={PERIOD_COPY[contactMode].message}
              period={views.contacts.message[contactMode]}
              same={PERIOD_COPY[contactMode].same}
              against={PERIOD_COPY[contactMode].against}
            />
          </div>
        </div>
      ) : (
        <p className="cabinet-empty">Карточка ещё не привязана, поэтому статистики нет.</p>
      )}
    </>
  );
}
