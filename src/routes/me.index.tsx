import { useState, type ReactNode } from "react";
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";

import { CabinetNotice } from "@/components/cabinet";
import { SiteFaq } from "@/components/site-faq";
import { TrainerContactStatus } from "@/components/trainer-contact-status";
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
import type { TrainerViewPeriod } from "@/lib/catalog/trainer-views";
import { countRu, pluralRu } from "@/lib/ru-plural";

type PulseMode = "day" | "week" | "month";

const PERIOD_COPY: Record<PulseMode, { link: string; visit: string; saved: string; shown: string; same: string; against: string }> = {
  day: { link: "сутки", visit: "Посещения за сутки", saved: "В избранное за сутки", shown: "Показы за сутки", same: "как вчера", against: "к вчерашнему" },
  week: { link: "неделя", visit: "За неделю", saved: "В избранное за неделю", shown: "За неделю", same: "как на прошлой неделе", against: "к прошлой неделе" },
  month: { link: "месяц", visit: "За месяц", saved: "В избранное за месяц", shown: "За месяц", same: "как в прошлом месяце", against: "к прошлому месяцу" },
};

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/")({
  head: () => ({
    meta: [
      { title: "Общая панель · личный кабинет тренера · trenio.by" },
      { name: "description", content: "Общая панель: статус страницы, посещения и рейтинг." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeOverviewPage,
});

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

function visitsAnswer(): ReactNode {
  return (
    <>
      <p>Посещение — это когда человек открыл вашу публичную страницу. Один и тот же человек за сутки считается один раз, сутки идут по минскому времени. Если страницу открыли вы сами, этот заход в счётчик не попадает.</p>
      <p>На той же плашке строка «В избранное» — сколько человек сохранили карточку за тот же срок. «В избранном сейчас» — сколько людей держат её на этот момент. Ссылки «сутки», «неделя» и «месяц» меняют оба числа и сравнение под ними.</p>
      <p>«За сутки» мы сравниваем со вчера. «За неделю» — с прошлой полной неделей: неделя начинается в понедельник, а эта ещё не закончилась. «За месяц» — с прошлым календарным месяцем.</p>
      <p>Плюс рядом с числом значит, что сейчас людей больше, чем в прошлый раз. Минус — меньше. Если написано «как вчера» или похожая фраза, число то же самое.</p>
    </>
  );
}

const CARD_LABELS: Array<{ key: keyof PopularityChecklist; label: string }> = [
  { key: "photo", label: "фото" },
  { key: "bio", label: "текст о себе" },
  { key: "about", label: "как проходят тренировки" },
  { key: "sports", label: "вид спорта" },
  { key: "experience", label: "стаж" },
  { key: "price", label: "цена" },
  { key: "format", label: "формат" },
  { key: "city", label: "город" },
  { key: "place", label: "адрес" },
  { key: "certificate", label: "диплом" },
];

const CONTACT_LABELS: Array<{ key: keyof PopularityChecklist; label: string }> = [
  { key: "phone", label: "телефон" },
  { key: "instagram", label: "Instagram" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "почта" },
];

function joinRu(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
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

function popularityAnswer(
  parts: PopularityParts | null,
  rating: TrainerRatingSnapshot | null,
  checklist: PopularityChecklist | null,
): ReactNode {
  const limits = POPULARITY_LIMITS;
  if (!parts || !rating || !checklist) {
    return (
      <p>Рейтинг — это баллы от 0 до 100. Чем их больше, тем выше карточка в каталоге, когда человек выбирает «По рейтингу».</p>
    );
  }
  const cardMissing = CARD_LABELS.filter((item) => !checklist[item.key]).map((item) => item.label);
  const contactMissing = CONTACT_LABELS.filter((item) => !checklist[item.key]).map((item) => item.label);
  const fromUsers = parts.rating + parts.reviews + parts.views + parts.saves;
  const cardLine = checklist.card === limits.cardFields
    ? `Карточка уже собрана: все ${limits.card} баллов за поля ваши.`
    : `Карточку можно собрать самим, ещё до отзывов. Десять полей, каждое по ${limits.cardEach} ${pluralRu(limits.cardEach, "балл", "балла", "баллов")}: фото, текст о себе, как проходят тренировки, вид спорта, стаж, цена, формат, город, адрес и диплом. Закрыто ${checklist.card} из ${limits.cardFields} — это ${points(parts.card)}. Осталось: ${joinRu(cardMissing)}.`;
  const contactLine = checklist.contacts === limits.contactFields
    ? `Контакты тоже на месте. Телефон, Instagram, Telegram и почта закрывают ещё ${limits.contacts} баллов. Вместе с полями это ваши ${limits.self}.`
    : `Контакты тоже ваши и входят в те же ${limits.self}. Телефон, Instagram, Telegram и почта вместе дают ${limits.contacts} баллов: один — 3, два — 5, три — 8. Добавлено ${checklist.contacts} из ${limits.contactFields} — это ${points(parts.contacts)}. Не хватает: ${joinRu(contactMissing)}.`;
  const peopleLine = fromUsers === 0
    ? `От пользователей можно набрать ещё до ${limits.rating + limits.reviews + limits.views + limits.saves} баллов, и первые шаги самые щедрые. Пятёрка даёт ${limits.rating}, ${limits.reviewCap} отзывов — ${limits.reviews}, ${limits.viewCap} визитов за месяц — ${limits.views}, ${limits.saveCap} сохранений — ${limits.saves}.`
    : `От пользователей сейчас ${points(fromUsers)}. Оценки — ${parts.rating} из ${limits.rating}, отзывы — ${parts.reviews} из ${limits.reviews}, визиты этого месяца — ${parts.views} из ${limits.views}, избранное — ${parts.saves} из ${limits.saves}. Первые шаги здесь заметнее следующих.`;

  return (
    <>
      <p>Это ваши баллы от 0 до 100. Чем их больше, тем выше карточка, когда в каталоге выбрано «По рейтингу». Сейчас у вас {parts.total}. До {limits.self} вы собираете сами, остальное приносят пользователи.</p>
      <p>{cardLine}</p>
      <p>{contactLine}</p>
      <p>{peopleLine}</p>
    </>
  );
}

function showsAnswer(): ReactNode {
  return (
    <>
      <p>Показ — это когда ваша карточка появилась в каталоге: на главной, в категории, в городе, в поиске или на карте. Человек мог не открывать страницу. Открытие считается отдельно, как посещение.</p>
      <p>Один человек за сутки даёт один показ, даже если карточка встретилась несколько раз. Ваш собственный просмотр не считается. Список избранного в кабинете показом не является.</p>
      <p>Ссылки на плашке те же: сутки, неделя и месяц. Сравнение считается так же, как у посещений.</p>
    </>
  );
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

function PageStatusCard({ status }: { status: PageStatus }) {
  const router = useRouter();
  const saveStatus = useAuthServerFn(setOwnTrainerPageStatusFn);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const live = status === "published";
  function apply(next: OwnProfileStatus) {
    if (pending || next === status) return;
    setPending(true);
    setError("");
    void saveStatus({ data: { status: next } })
      .then(() => router.invalidate())
      .catch((err: unknown) => setError(authErrorMessage(err) || "Не удалось сменить статус страницы."))
      .finally(() => setPending(false));
  }
  return (
    <article className="cabinet-card">
      <div className="cabinet-page-status">
        <h2>Страница</h2>
        <div className="cabinet-page-status__side">
          <span className={`cabinet-status cabinet-status--${status}`}>{PAGE_STATUS_LABEL[status]}</span>
          <button
            type="button"
            className={`mail-switch${live ? " is-on" : ""}`}
            aria-pressed={live}
            aria-label={live ? "Скрыть страницу из каталога" : "Показать страницу в каталоге"}
            disabled={pending}
            onClick={() => apply(live ? "hidden" : "published")}
          >
            <span className="mail-switch__thumb" />
          </button>
        </div>
      </div>
      <fieldset className="publish-pick" disabled={pending}>
        <legend>Режим страницы</legend>
        <div className="publish-pick__row" role="group" aria-label="Режим страницы">
          {OWN_PROFILE_STATUSES.map((mode) => {
            const on = status === mode;
            return (
              <label key={mode} className={`publish-pick__option is-${mode}${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => apply(mode)} />
                <span className="publish-pick__box" aria-hidden="true" />
                <span>{PAGE_MODE_LABEL[mode]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error ? <CabinetNotice title="Не получилось" message={error} onClose={() => setError("")} /> : null}
    </article>
  );
}

function MeOverviewPage() {
  const { trainer, views, ratings } = meRoute.useLoaderData();
  const [visitMode, setVisitMode] = useState<PulseMode>("day");
  const [showMode, setShowMode] = useState<PulseMode>("day");
  const hasProfile = Boolean(trainer?.slug);
  const rating = hasProfile && trainer ? ratingFor(trainer.slug, ratings) : null;
  const checklist = checklistFor(trainer);
  const parts = rating
    ? popularityParts({ ...rating, cardFilled: checklist?.card ?? 0, contactsFilled: checklist?.contacts ?? 0 })
    : null;

  return (
    <>
      {trainer ? <PageStatusCard status={trainer.pageStatus} /> : null}
      {hasProfile && views ? (
        <div className="cabinet-stats">
          <div className="cabinet-stat">
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
              note={`в избранном сейчас ${countRu(views.favorites.total, "человек", "человека", "человек")}`}
            />
          </div>
          <div className="cabinet-stat">
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
          <div className="cabinet-stat cabinet-stat--brand">
            <StatMark>
              <path d="M4 16l5-5 4 3 7-7" />
              <path d="M14 7h6v6" />
            </StatMark>
            <strong>{parts?.total ?? 0}</strong>
            <span>Рейтинг</span>
            <span className="cabinet-stat__delta is-flat">из 100</span>
          </div>
        </div>
      ) : null}
      {trainer ? (
        <article className="cabinet-card">
          <h2>Что уже есть</h2>
          <TrainerContactStatus profile={trainer} />
        </article>
      ) : null}
      <section className="cabinet-faq" aria-labelledby="me-faq">
        <h2 id="me-faq">Частые вопросы</h2>
        <SiteFaq
          items={[
            { q: "Как считаются посещения?", a: visitsAnswer() },
            { q: "Что такое показ?", a: showsAnswer() },
            { q: "Как считается рейтинг?", a: popularityAnswer(parts, rating, checklist) },
            {
              q: "Когда способ связи виден клиенту?",
              a: "Клиент видит не всё, что указано в профиле. Телефон и Telegram добавляются здесь. Телефон появляется на странице после SMS. Если Telegram сам передаёт номер, номер сразу считается подтверждённым. Добавление только телефона Telegram не меняет. Telegram на странице появляется после кнопки бота. Если вместе с ним приходит номер, номер тоже подтверждается. Instagram уже показан, если профиль пришёл из Instagram или в карточке есть ссылка. Почта на странице — та же, которой вы входите в аккаунт, после кода из письма.",
            },
          ]}
        />
      </section>
    </>
  );
}
