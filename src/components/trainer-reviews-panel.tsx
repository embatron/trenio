import { useState } from "react";

import { ReviewHtml } from "@/components/review-html";
import { ReviewStars } from "@/components/review-stars";
import { UserAvatar } from "@/components/user-avatar";
import { TablePager, useTablePage } from "@/components/table-pager";
import { authErrorMessage } from "@/lib/auth/errors";
import { replyToTrainerReviewFn, type OwnTrainerReview } from "@/lib/catalog/trainer-reviews";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const replyDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function TrainerReviewsPanel({ reviews }: { reviews: OwnTrainerReview[] }) {
  const reply = useAuthServerFn(replyToTrainerReviewFn);
  const [items, setItems] = useState(reviews);
  const [openId, setOpenId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const pager = useTablePage(items);

  if (items.length === 0) {
    return <p className="cabinet-empty">Отзывов о вашем профиле пока нет.</p>;
  }

  return (
    <div className="cabinet-review-list">
      {pager.rows.map((review) => (
        <article key={review.id} className="cabinet-review">
          <div className="cabinet-row">
            <div className="cabinet-row__who">
              <UserAvatar name={review.author} src={review.avatarPath} size={40} />
              <div>
                <span className="cabinet-review__pair">
                  <strong>{review.author}</strong>
                  <ReviewStars rating={review.rating} />
                </span>
                <span>{review.statusLabel}</span>
              </div>
            </div>
            <time>{review.date}</time>
          </div>
          <div className="cabinet-review__body">
          <ReviewHtml html={review.text} />
          {review.messages.map((message, index) => (
            <div key={`${review.id}-${index}`} className="cabinet-review__reply">
              <span className="review-reply__who">
                <UserAvatar name={message.role === "trainer" ? "Тренер" : message.author} src={message.avatarPath} size={28} />
                <span className="cabinet-media__label">{message.role === "trainer" ? "Ваш ответ" : message.author}</span>
              </span>
              <p>{message.body}</p>
            </div>
          ))}
          {review.canReply && openId !== review.id ? (
            <button type="button" className="cabinet-review__open" onClick={() => { setOpenId(review.id); setError(null); }}>
              Ответить
            </button>
          ) : null}
          {review.canReply && openId === review.id ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const text = (drafts[review.id] ?? "").trim();
                if (text.length < 10) {
                  setError({ id: review.id, message: "Напишите хотя бы 10 символов." });
                  return;
                }
                setPendingId(review.id);
                setError(null);
                void reply({ data: { id: review.id, reply: text } })
                  .then(() => {
                    setItems((current) => current.map((item) => item.id === review.id ? {
                      ...item,
                      canReply: false,
                      messages: [...item.messages, {
                        role: "trainer",
                        author: "Тренер",
                        avatarPath: item.trainerAvatar,
                        body: text,
                        date: replyDate.format(new Date()),
                      }],
                    } : item));
                    setDrafts((current) => ({ ...current, [review.id]: "" }));
                    setOpenId("");
                  })
                  .catch((err: unknown) => setError({ id: review.id, message: authErrorMessage(err) }))
                  .finally(() => setPendingId(""));
              }}
            >
              <label>
                <span>Ответ</span>
                <textarea
                  required
                  maxLength={1000}
                  value={drafts[review.id] ?? ""}
                  placeholder="Один ответ на этот отзыв"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((current) => ({ ...current, [review.id]: value }));
                    if (error?.id === review.id) setError(null);
                  }}
                />
              </label>
              {error?.id === review.id ? <p className="cabinet-form__error" role="alert">{error.message}</p> : null}
              <div className="cabinet-review__actions">
                <button className="cabinet-form__submit" type="submit" disabled={pendingId === review.id}>
                  {pendingId === review.id ? "Публикация…" : "Ответить"}
                </button>
                <button className="cabinet-review__cancel" type="button" onClick={() => { setOpenId(""); setError(null); }}>
                  Отмена
                </button>
              </div>
            </form>
          ) : review.status !== "published" ? (
            <p className="cabinet-note">Ответ можно оставить после публикации отзыва.</p>
          ) : null}
          </div>
        </article>
      ))}
      <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
    </div>
  );
}
