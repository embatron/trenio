import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ReviewStatus } from "@/components/cabinet";
import { ReviewHtml } from "@/components/review-html";
import { getAdminReviewsFn } from "@/lib/admin/reviews";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { setTrainerReviewStatusFn, type ReviewStatus as ReviewStatusValue } from "@/lib/catalog/trainer-reviews";

const CHECK = "M5 12l5 5L20 7";
const CROSS = "M6 6l12 12M18 6L6 18";

export const Route = createFileRoute("/admin/reviews")({
  loader: () => getAdminReviewsFn(),
  head: () => ({
    meta: [
      { title: "Отзывы · кабинет администратора · trenio.by" },
      { name: "description", content: "Модерация отзывов." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminReviewsPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function IconButton({
  label,
  path,
  disabled,
  type = "button",
  onClick,
}: {
  label: string;
  path: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button className="cabinet-icon-btn" type={type} disabled={disabled} aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>
    </button>
  );
}

function AdminReviewsPage() {
  const reviews = Route.useLoaderData();
  const router = useRouter();
  const [busyReview, setBusyReview] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const setReviewStatus = useAuthServerFn(setTrainerReviewStatusFn);
  const rejecting = reviews.find((review) => review.id === rejectingId) ?? null;

  useEffect(() => {
    if (!rejecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRejectingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rejecting]);

  function changeReview(id: string, status: Extract<ReviewStatusValue, "published" | "rejected">, note?: string) {
    setBusyReview(id);
    setRejectError(null);
    void setReviewStatus({ data: { id, status, note } })
      .then(() => {
        setRejectingId(null);
        setRejectNote("");
        return router.invalidate();
      })
      .catch(() => setRejectError("Не удалось сохранить решение."))
      .finally(() => setBusyReview(null));
  }

  return (
    <article className="cabinet-card">
      <h2>Модерация отзывов</h2>
      {reviews.length === 0 ? <p className="cabinet-empty">Отзывов пока нет.</p> : (
        <div className="cabinet-table-wrap">
          <table className="cabinet-table">
            <thead>
              <tr>
                <th>Отправитель</th>
                <th>Тренер</th>
                <th>Оценка</th>
                <th>Текст</th>
                <th>Статус</th>
                <th>Решение</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.authorName}</strong>
                    <span>{review.authorEmail}</span>
                  </td>
                  <td>
                    <Link className="cabinet-inline-link" to="/trainers/$slug" params={{ slug: review.trainerSlug }}>{review.trainerName}</Link>
                  </td>
                  <td>{review.rating} из 5</td>
                  <td><ReviewHtml html={review.body} /></td>
                  <td className="cabinet-status-cell">
                    <div className="cabinet-status-stack">
                      <ReviewStatus status={review.status} />
                      <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                      {review.status === "rejected" && review.moderationNote ? <span>{review.moderationNote}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="cabinet-actions">
                      {review.status !== "published" ? (
                        <IconButton label="Опубликовать" path={CHECK} disabled={busyReview === review.id} onClick={() => changeReview(review.id, "published")} />
                      ) : null}
                      {review.status !== "rejected" ? (
                        <IconButton
                          label="Отклонить"
                          path={CROSS}
                          disabled={busyReview === review.id}
                          onClick={() => {
                            setRejectingId(review.id);
                            setRejectNote("");
                            setRejectError(null);
                          }}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rejecting ? (
        <div className="cabinet-modal" onClick={() => setRejectingId(null)}>
          <form
            className="cabinet-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-review-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const note = rejectNote.trim();
              if (note.length < 5) {
                setRejectError("Напишите комментарий для клиента, хотя бы 5 символов.");
                return;
              }
              changeReview(rejecting.id, "rejected", note);
            }}
          >
            <h2 id="reject-review-title">Отклонить отзыв</h2>
            <label>
              <span>Комментарий клиенту</span>
              <textarea value={rejectNote} maxLength={500} autoFocus onChange={(event) => setRejectNote(event.target.value)} />
            </label>
            {rejectError ? <p className="cabinet-form__error">{rejectError}</p> : null}
            <div className="cabinet-actions">
              <IconButton label="Отклонить" path={CHECK} type="submit" disabled={busyReview === rejecting.id} />
              <IconButton label="Закрыть" path={CROSS} onClick={() => setRejectingId(null)} />
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}
