import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";

import { useCabinetTick } from "@/components/cabinet-live";

import { MESSAGE_ENVELOPE } from "@/components/messages/direct-mark";
import { getAdminOverviewFn } from "@/lib/admin/overview";
import type { TrainerViewPeriod } from "@/lib/catalog/trainer-periods";
import { pluralRu } from "@/lib/ru-plural";

type PulseMode = "day" | "week" | "month";

const PERIOD_COPY: Record<PulseMode, { link: string; same: string; against: string }> = {
  day: { link: "сутки", same: "как вчера", against: "ко вчерашнему" },
  week: { link: "неделя", same: "как на прошлой неделе", against: "к прошлой неделе" },
  month: { link: "месяц", same: "как в прошлом месяце", against: "к прошлому месяцу" },
};

const LABELS = {
  popular: { day: "Лидер по посещениям за сутки", week: "Лидер по посещениям за неделю", month: "Лидер по посещениям за месяц" },
  popularMany: { day: "Лидеры по посещениям за сутки", week: "Лидеры по посещениям за неделю", month: "Лидеры по посещениям за месяц" },
  messages: { day: "Сообщения за сутки", week: "Сообщения за неделю", month: "Сообщения за месяц" },
  reviews: { day: "Отзывы за сутки", week: "Отзывы за неделю", month: "Отзывы за месяц" },
  published: { day: "Опубликованные за сутки", week: "Опубликованные за неделю", month: "Опубликованные за месяц" },
} as const;

export const Route = createFileRoute("/admin/")({
  loader: () => getAdminOverviewFn(),
  head: () => ({
    meta: [
      { title: "Обзор · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminOverviewPage,
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

function OpenMark() {
  return (
    <span className="cabinet-id__open" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M14 5h5v5" />
        <path d="M13 11l6-6" />
        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </svg>
    </span>
  );
}

function AdminOverviewPage() {
  const data = Route.useLoaderData();
  const tick = useCabinetTick();
  const router = useRouter();
  const seen = useRef(0);
  useEffect(() => {
    if (tick === 0 || tick === seen.current) return;
    seen.current = tick;
    void router.invalidate();
  }, [tick, router]);
  const [popularMode, setPopularMode] = useState<PulseMode>("day");
  const [messageMode, setMessageMode] = useState<PulseMode>("day");
  const [reviewMode, setReviewMode] = useState<PulseMode>("day");
  const [publishedMode, setPublishedMode] = useState<PulseMode>("day");
  const leader = data.popular[popularMode];
  const popularDelta = periodDelta(
    { current: leader.visits, previous: leader.previous },
    PERIOD_COPY[popularMode].same,
    PERIOD_COPY[popularMode].against,
  );
  const messagePeriod = data.messages[messageMode];
  const reviewPeriod = data.reviews[reviewMode];
  const publishedPeriod = data.published[publishedMode];

  return (
    <>
      <div className="cabinet-stats">
        <div className="cabinet-stat">
          <StatMark>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
          </StatMark>
          <PeriodSwitch value={popularMode} label="Период лидера по посещениям" onChange={setPopularMode} />
          <div className="cabinet-stat__figure">
            <strong>{leader.visits}</strong>
            <span>{leader.trainers.length > 1 ? LABELS.popularMany[popularMode] : LABELS.popular[popularMode]}</span>
            {leader.trainers.length ? (
              <ul className="cabinet-stat__leaders">
                {leader.trainers.map((trainer) => (
                  <li key={trainer.slug || trainer.name}><LeaderName trainer={trainer} /></li>
                ))}
              </ul>
            ) : null}
            <span className={`cabinet-stat__delta ${popularDelta.className}`}>{popularDelta.text}</span>
          </div>
        </div>
        <div className="cabinet-stat">
          <StatMark>
            <path d={MESSAGE_ENVELOPE} />
          </StatMark>
          <PeriodSwitch value={messageMode} label="Период сообщений" onChange={setMessageMode} />
          <CountFigure
            value={messagePeriod.current}
            label={LABELS.messages[messageMode]}
            period={messagePeriod}
            mode={messageMode}
          />
        </div>
        <div className="cabinet-stat">
          <StatMark>
            <path d="M5 6h14v9H8l-3 3V6z" />
          </StatMark>
          <PeriodSwitch value={reviewMode} label="Период отзывов" onChange={setReviewMode} />
          <CountFigure
            value={reviewPeriod.current}
            label={LABELS.reviews[reviewMode]}
            period={reviewPeriod}
            mode={reviewMode}
          />
        </div>
        <div className="cabinet-stat">
          <StatMark>
            <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
          </StatMark>
          <PeriodSwitch value={publishedMode} label="Период публикаций" onChange={setPublishedMode} />
          <CountFigure
            value={publishedPeriod.current}
            label={LABELS.published[publishedMode]}
            period={publishedPeriod}
            mode={publishedMode}
          />
        </div>
      </div>
      <div className="cabinet-stats">
        <div className="cabinet-stat">
          <strong>{data.trainersTotal}</strong>
          <span>{pluralRu(data.trainersTotal, "тренер", "тренера", "тренеров")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.reviewsTotal}</strong>
          <span>{pluralRu(data.reviewsTotal, "отзыв", "отзыва", "отзывов")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.reviewsPending}</strong>
          <span>{pluralRu(data.reviewsPending, "отзыв на модерации", "отзыва на модерации", "отзывов на модерации")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.accountsTotal}</strong>
          <span>{pluralRu(data.accountsTotal, "аккаунт", "аккаунта", "аккаунтов")}</span>
        </div>
      </div>
    </>
  );
}

function CountFigure({
  value,
  label,
  period,
  mode,
}: {
  value: number;
  label: string;
  period: TrainerViewPeriod;
  mode: PulseMode;
}) {
  const delta = periodDelta(period, PERIOD_COPY[mode].same, PERIOD_COPY[mode].against);
  return (
    <div className="cabinet-stat__figure">
      <strong>{value}</strong>
      <span>{label}</span>
      <span className={`cabinet-stat__delta ${delta.className}`}>{delta.text}</span>
    </div>
  );
}

function LeaderName({ trainer }: { trainer: { slug: string; name: string; published: boolean } }) {
  if (!trainer.slug) return <span className="cabinet-stat__who">{trainer.name}</span>;
  if (trainer.published) {
    return (
      <a className="cabinet-stat__who" href={`/trainers/${trainer.slug}`} target="_blank" rel="noopener noreferrer" title="Открыть публичный профиль">
        {trainer.name}
        <OpenMark />
      </a>
    );
  }
  return (
    <Link to="/admin/trainers/$slug" params={{ slug: trainer.slug }} className="cabinet-stat__who" title="Открыть карточку">
      {trainer.name}
    </Link>
  );
}
