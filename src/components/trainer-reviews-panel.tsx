import { useState } from "react";

import { ReviewHtml } from "@/components/review-html";
import { UserAvatar } from "@/components/user-avatar";
import { TablePager, useTablePage } from "@/components/table-pager";
import { authErrorMessage } from "@/lib/auth/errors";
import { replyToTrainerReviewFn, type OwnTrainerReview } from "@/lib/catalog/trainer-reviews";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

export function TrainerReviewsPanel({ reviews }: { reviews: OwnTrainerReview[] }) {
  const reply = useAuthServerFn(replyToTrainerReviewFn);
  const [items, setItems] = useState(reviews);
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
          <div className="cabinet-review__head">
            <span className="review-item__who">
              <UserAvatar name={review.author} src={review.avatarPath} />
              <strong>{review.author}</strong>
            </span>
            <span className="cabinet-note">{review.statusLabel} · {review.date}</span>
          </div>
          <span className="cabinet-note">{review.rating} из 5</span>
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
          {review.canReply ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const text = (drafts[review.id] ?? "").trim();
                setPendingId(review.id);
                setError(null);
                void reply({ data: { id: review.id, reply: text } })
                  .then(() => {
                    setItems((current) => current.map((item) => item.id === review.id ? {
                      ...item,
                      canReply: false,
                      messages: [...item.messages, { role: "trainer", author: "Тренер", avatarPath: item.trainerAvatar, body: text, date: "" }],
                    } : item));
                    setDrafts((current) => ({ ...current, [review.id]: "" }));
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
                  placeholder="Ответ автору отзыва"
                  onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                />
              </label>
              {error?.id === review.id ? <p className="cabinet-form__error">{error.message}</p> : null}
              <button className="cabinet-form__submit" type="submit" disabled={pendingId === review.id}>
                {pendingId === review.id ? "Публикация…" : "Ответить"}
              </button>
            </form>
          ) : review.status !== "published" ? (
            <p className="cabinet-note">Ответ можно оставить после публикации отзыва.</p>
          ) : null}
        </article>
      ))}
      <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
    </div>
  );
}
