import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { REVIEW_STATUS_LABEL, ReviewStatus } from "@/components/cabinet";
import { TablePager, useTablePage } from "@/components/table-pager";
import { ReviewHtml } from "@/components/review-html";
import { UserAvatar } from "@/components/user-avatar";
import { getAdminReviewsFn, type AdminReview } from "@/lib/admin/reviews";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getSportTaxonomyChild, listSecondLevelSports, TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";
import { REVIEW_STATUSES, setTrainerReviewStatusFn, type ReviewStatus as ReviewStatusValue } from "@/lib/catalog/trainer-reviews";

type ReviewSort = "date-desc" | "date-asc" | "rating-desc" | "rating-asc";

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

function compareReviews(a: AdminReview, b: AdminReview, sort: ReviewSort) {
  if (sort === "rating-desc" || sort === "rating-asc") {
    const byRating = sort === "rating-desc" ? b.rating - a.rating : a.rating - b.rating;
    return byRating || b.createdAt.localeCompare(a.createdAt);
  }
  return sort === "date-asc" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
}

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
  const [status, setStatus] = useState<"" | ReviewStatusValue>("");
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [sort, setSort] = useState<ReviewSort>("date-desc");
  const [busyReview, setBusyReview] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const setReviewStatus = useAuthServerFn(setTrainerReviewStatusFn);
  const rejecting = reviews.find((review) => review.id === rejectingId) ?? null;
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visible = useMemo(() => {
    const rows = reviews.filter((review) => {
      const parents = review.trainerSportSlugs.map((slug) => getSportTaxonomyChild(slug)?.parentSlug);
      if (status && review.status !== status) return false;
      if (category && !parents.includes(category)) return false;
      if (sport && !review.trainerSportSlugs.includes(sport)) return false;
      return true;
    });
    rows.sort((a, b) => compareReviews(a, b, sort));
    return rows;
  }, [reviews, status, category, sport, sort]);
  const pager = useTablePage(visible, `${status}|${category}|${sport}|${sort}`);

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
        <>
          <div className="cabinet-filters">
            <label>
              <span>Статус</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as "" | ReviewStatusValue)}>
                <option value="">Все статусы</option>
                {REVIEW_STATUSES.map((item) => (
                  <option key={item} value={item}>{REVIEW_STATUS_LABEL[item]}</option>
                ))}
              </select>
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
              <span>Сортировка</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)}>
                <option value="date-desc">Сначала новые</option>
                <option value="date-asc">Сначала старые</option>
                <option value="rating-desc">Сначала высокая оценка</option>
                <option value="rating-asc">Сначала низкая оценка</option>
              </select>
            </label>
          </div>
          {visible.length === 0 ? <p className="cabinet-empty">Нет отзывов с таким фильтром.</p> : (
        <>
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
              {pager.rows.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className="cabinet-person">
                      <UserAvatar name={review.authorName} src={review.authorAvatar} />
                      <div>
                        <Link className="cabinet-name-link" to="/admin/accounts/$id" params={{ id: review.authorId }} target="_blank" rel="noopener noreferrer">{review.authorName}</Link>
                        <span>{review.authorEmail}</span>
                      </div>
                    </div>
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
        <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
        </>
      )}
        </>
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
              <textarea required value={rejectNote} maxLength={500} autoFocus onChange={(event) => setRejectNote(event.target.value)} />
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
