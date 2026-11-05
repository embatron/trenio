import { Link } from "@tanstack/react-router";

import { UnreadBadge } from "@/components/messages/unread-badge";
import { TrainerName } from "@/components/trainer-name";
import { UserAvatar } from "@/components/user-avatar";
import type { ConversationListItem } from "@/lib/messages/schemas";

function ReceiptMarks({ receipt }: { receipt: "delivered" | "read" | null }) {
  if (!receipt) return null;
  const read = receipt === "read";
  const label = read ? "Прочитано" : "Доставлено";
  return (
    <span className={`direct-receipt${read ? " is-read" : ""}`} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {read ? (
          <>
            <path d="M1.5 12.5 6 17l7.5-9" />
            <path d="M8 12.5 12.5 17 22 6.5" />
          </>
        ) : (
          <path d="M5 12.5 10 17.5 19.5 7" />
        )}
      </svg>
      <span className="direct-receipt__label">{label}</span>
    </span>
  );
}

function whenLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

export function ConversationList({
  view,
  items,
  activeId,
  loading,
  error,
  hasMore,
  loadingMore,
  onMore,
  onOpen,
}: {
  view: "own" | "inbox" | "staff";
  items: ConversationListItem[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="direct-list">
      <h2>Сообщения</h2>
      {loading ? (
        <div className="direct-skeletons" aria-hidden="true">
          <span /><span /><span />
        </div>
      ) : error ? (
        <p className="direct-empty">{error}</p>
      ) : items.length === 0 ? (
        <p className="direct-empty">{view === "own" ? "Сообщений пока нет — напишите тренеру с его карточки" : view === "staff" ? "Переписок пока нет" : "Сообщений пока нет"}</p>
      ) : (
        <ul>
          {items.map((item) => {
            const className = item.id === activeId ? "is-active" : undefined;
            const body = (
              <>
                <UserAvatar name={item.counterpart.name} src={item.counterpart.avatarPath || null} size={44} />
                <span className="direct-list__text">
                  <strong>
                    <TrainerName firstName={item.counterpart.firstName} lastName={item.counterpart.lastName} empty={item.counterpart.name} />
                    {item.aside ? <span className="direct-list__aside"> · {item.aside}</span> : null}
                  </strong>
                  <em>{item.preview || "Нет сообщений"}</em>
                </span>
                <span className="direct-list__meta">
                  <span className="direct-list__when">
                    <ReceiptMarks receipt={item.receipt} />
                    <time dateTime={item.activityAt}>{whenLabel(item.activityAt)}</time>
                  </span>
                  <UnreadBadge count={item.unread} />
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {onOpen ? (
                  <button
                    type="button"
                    className={`direct-list__row${className ? ` ${className}` : ""}`}
                    aria-current={item.id === activeId ? "page" : undefined}
                    onClick={() => onOpen(item.id)}
                  >
                    {body}
                  </button>
                ) : view === "own" ? (
                  <Link
                    className={className}
                    to="/account/messages/$conversationId"
                    params={{ conversationId: item.id }}
                    aria-current={item.id === activeId ? "page" : undefined}
                  >
                    {body}
                  </Link>
                ) : (
                  <Link
                    className={className}
                    to="/me/messages/$conversationId"
                    params={{ conversationId: item.id }}
                    aria-current={item.id === activeId ? "page" : undefined}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore ? (
        <button type="button" className="direct-more" onClick={onMore} disabled={loadingMore}>
          {loadingMore ? "Загрузка…" : "Более ранние"}
        </button>
      ) : null}
    </div>
  );
}
