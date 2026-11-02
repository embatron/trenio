import type { ReactNode } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { SiteFaq } from "@/components/site-faq";
import { TrainerContactStatus } from "@/components/trainer-contact-status";
import {
  POPULARITY_LIMITS,
  popularityChecklist,
  popularityParts,
  type PopularityChecklist,
  type PopularityParts,
  ratingFor,
  type TrainerRatingSnapshot,
} from "@/lib/catalog/trainer-popularity";
import type { OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import type { TrainerViewPeriod } from "@/lib/catalog/trainer-views";
import { countRu, pluralRu } from "@/lib/ru-plural";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/")({
  head: () => ({
    meta: [
      { title: "Личный кабинет тренера · trenio.by" },
      { name: "description", content: "Личный кабинет: профиль, отзывы и сообщения." },
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

function ViewStat({
  value,
  label,
  period,
  same,
  against,
  icon,
}: {
  value: number;
  label: string;
  period: TrainerViewPeriod;
  same: string;
  against: string;
  icon: ReactNode;
}) {
  const delta = periodDelta(period, same, against);
  return (
    <div className="cabinet-stat">
      <StatMark>{icon}</StatMark>
      <strong>{value}</strong>
      <span>{label}</span>
      <span className={`cabinet-stat__delta ${delta.className}`}>{delta.text}</span>
    </div>
  );
}

function visitsAnswer(): ReactNode {
  return (
    <>
      <p>Посещение — это когда человек открыл вашу публичную страницу. Один и тот же человек за сутки считается один раз, сутки идут по минскому времени. Если страницу открыли вы сами, этот заход в счётчик не попадает.</p>
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
      <p>Популярность — это баллы от 0 до 100. Чем их больше, тем выше карточка в каталоге, когда человек выбирает «По популярности».</p>
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
      <p>Это ваши баллы от 0 до 100. Чем их больше, тем выше карточка, когда в каталоге выбрано «По популярности». Сейчас у вас {parts.total}. До {limits.self} вы собираете сами, остальное приносят пользователи.</p>
      <p>{cardLine}</p>
      <p>{contactLine}</p>
      <p>{peopleLine}</p>
    </>
  );
}

function MeOverviewPage() {
  const { trainer, views, ratings } = meRoute.useLoaderData();
  const hasProfile = Boolean(trainer?.slug);
  const rating = hasProfile && trainer ? ratingFor(trainer.slug, ratings) : null;
  const checklist = checklistFor(trainer);
  const parts = rating
    ? popularityParts({ ...rating, cardFilled: checklist?.card ?? 0, contactsFilled: checklist?.contacts ?? 0 })
    : null;

  return (
    <>
      {hasProfile && views ? (
        <div className="cabinet-stats">
          <ViewStat
            value={views.day.current}
            label="Посещения за сутки"
            period={views.day}
            same="как вчера"
            against="к вчерашнему"
            icon={(
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M3 12h2M19 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
              </>
            )}
          />
          <ViewStat
            value={views.week.current}
            label="За неделю"
            period={views.week}
            same="как на прошлой неделе"
            against="к прошлой неделе"
            icon={<path d="M2.5 9v6M5.7 9v6M8.9 9v6M12.1 9v6M15.3 9v6M18.5 9v6M21.7 9v6" />}
          />
          <ViewStat
            value={views.month.current}
            label="За месяц"
            period={views.month}
            same="как в прошлом месяце"
            against="к прошлому месяцу"
            icon={(
              <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 17.5h2M11 17.5h2M15 17.5h2" />
              </>
            )}
          />
          <div className="cabinet-stat cabinet-stat--brand">
            <StatMark>
              <path d="M4 16l5-5 4 3 7-7" />
              <path d="M14 7h6v6" />
            </StatMark>
            <strong>{parts?.total ?? 0}</strong>
            <span>Популярность</span>
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
            { q: "Как считается популярность?", a: popularityAnswer(parts, rating, checklist) },
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
