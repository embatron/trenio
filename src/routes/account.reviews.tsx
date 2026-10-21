import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ReviewStatus } from "@/components/cabinet";
import { TablePager, useTablePage } from "@/components/table-pager";
import { ReviewHtml } from "@/components/review-html";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/reviews")({
  head: () => ({
    meta: [
      { title: "Мои отзывы · trenio.by" },
      { name: "description", content: "Отзывы и их статус: на модерации, опубликовано или отклонено." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountReviewsPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function AccountReviewsPage() {
  const { cabinet } = accountRoute.useLoaderData();
  const [rejectNote, setRejectNote] = useState<string | null>(null);
  const pager = useTablePage(cabinet.reviews);

  return (
    <>
      <article className="cabinet-card">
        <h2>Мои отзывы</h2>
        {cabinet.reviews.length === 0 ? (
          <p className="cabinet-empty">Вы ещё не оставляли отзывы. После отправки со страницы тренера статус появится в этом списке.</p>
        ) : pager.rows.map((review) => (
          <div key={review.id} className="cabinet-row">
            <div>
              <strong>{review.trainerName} · {review.rating} из 5</strong>
              <ReviewHtml html={review.body} />
              <Link className="cabinet-inline-link" to="/trainers/$slug" params={{ slug: review.trainerSlug }}>Профиль тренера</Link>
            </div>
            <div className="cabinet-status-stack">
              <div className="cabinet-status-line">
                <ReviewStatus status={review.status} />
                {review.status === "rejected" ? (
                  <button
                    type="button"
                    className="cabinet-status-help"
                    aria-label="Почему отзыв отклонён"
                    onClick={() => setRejectNote(review.moderationNote?.trim() || "Комментарий не указан.")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3.9-1.3 1.7V14" />
                      <path d="M12 17h.01" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            </div>
          </div>
        ))}
        <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
      </article>
      {rejectNote !== null ? <RejectionDialog note={rejectNote} onClose={() => setRejectNote(null)} /> : null}
    </>
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
    <div className="cabinet-modal" onClick={onClose}>
      <div
        className="cabinet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reject-title">Почему отзыв отклонён</h2>
        <p>{note}</p>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
