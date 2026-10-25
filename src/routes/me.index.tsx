import type { ReactNode } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { SiteFaq } from "@/components/site-faq";
import { TrainerContactStatus } from "@/components/trainer-contact-status";
import { POPULARITY_LIMITS, popularityParts, type PopularityParts, ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import type { TrainerViewPeriod } from "@/lib/catalog/trainer-views";
import { countRu } from "@/lib/ru-plural";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/")({
  head: () => ({
    meta: [
      { title: "Личный кабинет · trenio.by" },
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

function ViewStat({
  value,
  label,
  period,
  same,
  against,
}: {
  value: number;
  label: string;
  period: TrainerViewPeriod;
  same: string;
  against: string;
}) {
  const delta = periodDelta(period, same, against);
  return (
    <div className="cabinet-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <span className={`cabinet-stat__delta ${delta.className}`}>{delta.text}</span>
    </div>
  );
}

function comparedWith(period: TrainerViewPeriod, previous: string) {
  const diff = period.current - period.previous;
  if (diff === 0) return `столько же, сколько ${previous}`;
  const word = countRu(Math.abs(diff), "визит", "визита", "визитов");
  return diff > 0 ? `на ${word} больше, чем ${previous}` : `на ${word} меньше, чем ${previous}`;
}

function visitsAnswer(views: {
  day: TrainerViewPeriod;
  week: TrainerViewPeriod;
  month: TrainerViewPeriod;
} | null): ReactNode {
  return (
    <>
      <p>Посещение — это когда человек открыл вашу публичную страницу. Один и тот же человек за сутки считается один раз, сутки идут по минскому времени. Если страницу открыли вы сами, этот заход в счётчик не попадает.</p>
      <p>«За сутки» мы сравниваем со вчера. «За неделю» — с прошлой полной неделей: неделя начинается в понедельник, а эта ещё не закончилась. «За месяц» — с прошлым календарным месяцем.</p>
      <p>Плюс рядом с числом значит, что сейчас людей больше, чем в прошлый раз. Минус — меньше. Если написано «как вчера» или похожая фраза, число то же самое.</p>
      {views ? (
        <p>
          Сейчас за сутки {countRu(views.day.current, "визит", "визита", "визитов")}, это {comparedWith(views.day, "вчера")}. За неделю {countRu(views.week.current, "визит", "визита", "визитов")}, {comparedWith(views.week, "на прошлой неделе")}. За месяц {countRu(views.month.current, "визит", "визита", "визитов")}, {comparedWith(views.month, "в прошлом месяце")}.
        </p>
      ) : null}
    </>
  );
}

function popularityAnswer(parts: PopularityParts | null, rating: TrainerRatingSnapshot | null): ReactNode {
  const limits = POPULARITY_LIMITS;
  const yours = parts ? ` Сейчас у вас ${parts.total}.` : "";
  const ratingNow = parts && rating
    ? rating.reviews > 0
      ? ` Сейчас здесь ${parts.rating} из ${limits.rating}, средняя оценка ${rating.rating}.`
      : ` Сейчас здесь ${parts.rating} из ${limits.rating}: опубликованных отзывов пока нет.`
    : "";
  const reviewsNow = parts && rating
    ? ` Сейчас ${parts.reviews} из ${limits.reviews}: ${rating.reviews > 0 ? countRu(rating.reviews, "отзыв", "отзыва", "отзывов") : "отзывов пока нет"}.`
    : "";
  const viewsNow = parts && rating
    ? ` Сейчас ${parts.views} из ${limits.views}: в этом месяце ${countRu(rating.views, "просмотр", "просмотра", "просмотров")}.`
    : "";
  const savesNow = parts && rating
    ? ` Сейчас ${parts.saves} из ${limits.saves}: карточку ${rating.saves > 0 ? `сохранили ${countRu(rating.saves, "человек", "человека", "человек")}` : "пока никто не сохранил"}.`
    : "";

  return (
    <>
      <p>Популярность — это число от 0 до 100. Чем оно выше, тем выше карточка в каталоге, когда человек выбирает порядок «По популярности».{yours}</p>
      <p>Число складывается из четырёх частей. Первые отзывы, визиты и сохранения поднимают его заметнее, чем каждый следующий.</p>
      <p>Оценки — самая большая часть, до {limits.rating}. Это средняя оценка опубликованных отзывов. Пятёрка даёт все {limits.rating}.{ratingNow}</p>
      <p>Сколько людей уже оставили отзыв — до {limits.reviews}. {limits.reviewCap} отзывов хватает, чтобы закрыть эту часть целиком.{reviewsNow}</p>
      <p>Кто открывал страницу в этом месяце — до {limits.views}. Считаются те же визиты, что в счётчике «За месяц». {limits.viewCap} просмотров закрывают часть целиком.{viewsNow}</p>
      <p>Кто сохранил карточку в избранное — до {limits.saves}. {limits.saveCap} сохранений хватает, чтобы закрыть эту часть.{savesNow}</p>
    </>
  );
}

function MeOverviewPage() {
  const { trainer, views, ratings } = meRoute.useLoaderData();
  const hasProfile = Boolean(trainer?.slug);
  const rating = hasProfile && trainer ? ratingFor(trainer.slug, ratings) : null;
  const parts = rating ? popularityParts(rating) : null;

  return (
    <>
      {hasProfile && views ? (
        <div className="cabinet-stats">
          <ViewStat value={views.day.current} label="Посещения за сутки" period={views.day} same="как вчера" against="к вчерашнему" />
          <ViewStat value={views.week.current} label="За неделю" period={views.week} same="как на прошлой неделе" against="к прошлой неделе" />
          <ViewStat value={views.month.current} label="За месяц" period={views.month} same="как в прошлом месяце" against="к прошлому месяцу" />
          <div className="cabinet-stat">
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
            { q: "Как считаются посещения?", a: visitsAnswer(views) },
            { q: "Как считается популярность?", a: popularityAnswer(parts, rating) },
            {
              q: "Когда способ связи виден клиенту?",
              a: "Клиент видит не всё, что указано в профиле. Телефон появляется на странице после SMS. Telegram — после того, как вы подтвердите его в боте. Instagram виден сразу, как только в профиле есть ссылка. Почта для связи появляется после кода из письма. Это отдельная почта, не та, которой вы входите в аккаунт. В блоке «Что уже есть» видно, что уже указано и что уже подтверждено.",
            },
            {
              q: "Что уже можно сделать на сайте?",
              a: "Написать вам уже можно. Человек нажимает сообщение на карточке, и переписка появляется в разделе «Сообщения». Календарь, запись на занятие и оплата через сайт ещё делаем.",
            },
          ]}
        />
      </section>
    </>
  );
}
