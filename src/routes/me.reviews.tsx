import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CabinetModal, CabinetOpenMark } from "@/components/cabinet";
import { useCabinetLive, useCabinetReload } from "@/components/cabinet-live";
import { ReviewHtml } from "@/components/review-html";
import { ReviewStars } from "@/components/review-stars";
import { TrainerReviewsPanel } from "@/components/trainer-reviews-panel";
import type { UserCabinetReview } from "@/lib/cabinet";

const meRoute = getRouteApi("/me");

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Minsk",
});

const STATUS_LABEL = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
} as const;

export const Route = createFileRoute("/me/reviews")({
  head: () => ({
    meta: [
      { title: "Мои отзывы · Я ищу тренера на trenio.by" },
      { name: "description", content: "Отзывы на странице тренера и отзывы, которые он написал сам." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeReviewsPage,
});

function MeReviewsPage() {
  const { trainer, reviews, cabinet } = meRoute.useLoaderData();
  const live = useCabinetLive();
  useCabinetReload(live?.pulse ? live.trainerReviews : null, reviews.length);
  const [tab, setTab] = useState<"received" | "given">("received");
  const [rejectNote, setRejectNote] = useState<string | null>(null);

  return (
    <article className="cabinet-card">
      <h2>Мои отзывы</h2>
      <div className="cabinet-tabs" role="tablist" aria-label="Отзывы">
        <button type="button" role="tab" aria-selected={tab === "received"} onClick={() => setTab("received")}>
          Отзывы на моей странице
          <span className="cabinet-tab__count">{reviews.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "given"} onClick={() => setTab("given")}>
          Мои отзывы
          <span className="cabinet-tab__count">{cabinet.reviews.length}</span>
        </button>
      </div>
      {tab === "received" ? (
        trainer ? <TrainerReviewsPanel reviews={reviews} /> : <p className="cabinet-empty">Карточка ещё не привязана, поэтому отзывов нет.</p>
      ) : cabinet.reviews.length === 0 ? (
        <p className="cabinet-empty">Вы ещё никому не оставляли отзыв.</p>
      ) : (
        <div>
          {cabinet.reviews.map((review) => (
            <WrittenReview key={review.id} review={review} onReject={setRejectNote} />
          ))}
        </div>
      )}
      {rejectNote !== null ? <RejectionDialog note={rejectNote} onClose={() => setRejectNote(null)} /> : null}
    </article>
  );
}

function WrittenReview({ review, onReject }: { review: UserCabinetReview; onReject: (note: string) => void }) {
  return (
    <div className="cabinet-row">
      <div>
        <span className="cabinet-review__pair">
          <Link className="cabinet-id__line" to="/trainers/$slug" params={{ slug: review.trainerSlug }} target="_blank" rel="noreferrer" title="Открыть страницу">
            <strong>{review.trainerName}</strong>
            <CabinetOpenMark />
          </Link>
          <ReviewStars rating={review.rating} />
        </span>
        <span>{STATUS_LABEL[review.status]}</span>
        <ReviewHtml html={review.body} />
        {review.status === "rejected" ? (
          <button type="button" className="cabinet-name-link" onClick={() => onReject(review.moderationNote?.trim() || "Комментарий не указан.")}>
            Почему отклонён
          </button>
        ) : null}
      </div>
      <time dateTime={review.createdAt}>{when.format(new Date(review.createdAt))}</time>
    </div>
  );
}

function RejectionDialog({ note, onClose }: { note: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <CabinetModal onClick={onClose}>
      <div className="cabinet-modal__card" role="dialog" aria-modal="true" aria-labelledby="reject-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="reject-title">Почему отзыв отклонён</h2>
        <p>{note}</p>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </CabinetModal>
  );
}
