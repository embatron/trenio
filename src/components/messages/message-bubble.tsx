import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ReviewHtml } from "@/components/review-html";
import type { MessageDto } from "@/lib/messages/schemas";

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const LINE_ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "var(--icon-stroke)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 14 4 9l5-5" style={LINE_ICON} />
      <path d="M4 9h11a4 4 0 0 1 4 4v6" style={LINE_ICON} />
    </svg>
  );
}

const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";
const THUMB_PATHS = [
  "M7 10v12",
  "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
];

function ThumbMark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={THUMB_PATHS[0]} style={on ? { ...LINE_ICON, opacity: 0 } : LINE_ICON} />
      <path
        d={THUMB_PATHS[1]}
        style={on ? { fill: "currentColor", stroke: "none" } : LINE_ICON}
      />
    </svg>
  );
}

function LineIcon({ paths }: { paths: string[] }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} style={LINE_ICON} />
      ))}
    </svg>
  );
}

function ImageLightbox({
  zoom,
  onClose,
}: {
  zoom: { src: string; name: string };
  onClose: () => void;
}) {
  const [turn, setTurn] = useState(0);
  const sideways = turn % 180 !== 0;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="direct-lightbox" role="dialog" aria-modal="true" aria-label={zoom.name} onClick={onClose}>
      <div className="direct-lightbox__bar" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setTurn((value) => (value + 270) % 360)} aria-label="Повернуть влево">
          <LineIcon paths={["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"]} />
        </button>
        <button type="button" onClick={() => setTurn((value) => (value + 90) % 360)} aria-label="Повернуть вправо">
          <LineIcon paths={["M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5"]} />
        </button>
        <button type="button" className="direct-lightbox__close" onClick={onClose} aria-label="Закрыть">
          <LineIcon paths={["M6 6l12 12", "M18 6L6 18"]} />
        </button>
      </div>
      <img
        src={zoom.src}
        alt={zoom.name}
        className={sideways ? "is-sideways" : undefined}
        style={{ transform: `rotate(${turn}deg)` }}
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

export function MessageBubble({
  message,
  pending,
  onRetry,
  onQuote,
  onEdit,
  onLike,
  onFocusQuote,
  quoted,
  likeFlash = false,
}: {
  message: MessageDto & {
    status?: "sending" | "failed";
    pendingNames?: string[];
    localFiles?: { url: string; name: string; kind: "image" | "file" }[];
  };
  pending?: boolean;
  onRetry?: (message: MessageDto) => void;
  onQuote?: () => void;
  onEdit?: () => void;
  onLike?: () => void;
  onFocusQuote?: (id: number) => void;
  /** This message is quoted by another one in the thread. */
  quoted?: boolean;
  /** The mark just turned on. One quiet blink, then the class goes away. */
  likeFlash?: boolean;
}) {
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const mine = message.mine;
  const failed = message.status === "failed";
  const sending = message.status === "sending" || pending;

  const receipt = !mine || message.deleted || failed
    ? null
    : sending
      ? "Отправка…"
      : message.receipt === "read"
        ? "Прочитано"
        : "Доставлено";

  const replyButton = onQuote ? (
    <button type="button" className="direct-bubble__reply" onClick={onQuote} aria-label="Ответить">
      <ReplyIcon />
    </button>
  ) : null;

  return (
    <div className={`direct-row${mine ? " is-mine" : ""}`}>
      {mine ? replyButton : null}
      <div
        className={`direct-bubble is-${message.side}${mine ? " is-mine" : ""}${message.deleted ? " is-deleted" : ""}${quoted ? " is-quoted" : ""}`}
        onClick={(event) => {
          const spoiler = (event.target as HTMLElement).closest?.(".tg-spoiler");
          if (spoiler) spoiler.classList.toggle("is-open");
        }}
      >
        {!message.deleted && message.replyTo ? (
          <button type="button" className="direct-quote" onClick={() => onFocusQuote?.(message.replyTo!.id)} aria-label="Перейти к сообщению">
            <span>{message.replyTo.preview}</span>
          </button>
        ) : null}
        {message.deleted ? <p>Сообщение удалено</p> : message.body ? <ReviewHtml className="direct-bubble__text" html={message.body} /> : null}
        {!message.deleted && message.attachments?.length ? (
          <div className="direct-files">
            {message.attachments.map((file) => file.kind === "image" ? (
              <button
                key={file.id}
                type="button"
                className="direct-preview"
                aria-label={`Открыть ${file.name}`}
                onClick={() => setZoom({ src: `/messages/files/${file.id}`, name: file.name })}
              >
                <img src={`/messages/files/${file.id}?preview=1`} alt="" />
              </button>
            ) : (
              <a key={file.id} className="direct-file" href={`/messages/files/${file.id}`}>{file.name}</a>
            ))}
          </div>
        ) : null}
        {!message.deleted && !message.attachments?.length && message.localFiles?.length ? (
          <div className="direct-files">
            {message.localFiles.map((file) => file.kind === "image" ? (
              <button
                key={file.url}
                type="button"
                className="direct-preview"
                aria-label={`Открыть ${file.name}`}
                onClick={() => setZoom({ src: file.url, name: file.name })}
              >
                <img src={file.url} alt="" />
              </button>
            ) : (
              <span key={file.url} className="direct-file">{file.name}</span>
            ))}
          </div>
        ) : null}
        {!message.deleted && !message.attachments?.length && !message.localFiles?.length && message.pendingNames?.length ? (
          <div className="direct-files">
            {message.pendingNames.map((name) => <span key={name} className="direct-file">{name}</span>)}
          </div>
        ) : null}
        <div className="direct-bubble__meta">
          {!message.deleted && onEdit ? (
            <button type="button" className="direct-bubble__edit" onClick={onEdit} aria-label="Изменить">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d={EDIT_ICON} style={LINE_ICON} />
              </svg>
            </button>
          ) : null}
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
          {message.editedAt ? <span className="direct-bubble__state">изменено</span> : null}
          {receipt ? <span className={`direct-bubble__state${receipt === "Прочитано" ? " is-read" : ""}`}>{receipt}</span> : null}
          {onLike ? (
            <button
              type="button"
              className={`direct-bubble__like${message.liked ? " is-on" : ""}${message.liked && likeFlash ? " is-pop" : ""}`}
              aria-pressed={message.liked}
              aria-label={message.liked ? "Убрать отметку" : "Отметить"}
              onClick={onLike}
            >
              <ThumbMark on={message.liked} />
            </button>
          ) : message.peerLiked ? (
            <span className={`direct-bubble__like is-on is-seen${likeFlash ? " is-pop" : ""}`} aria-label="Отмечено">
              <ThumbMark on />
            </span>
          ) : null}
        </div>
        {failed ? (
          <button type="button" className="direct-bubble__retry" onClick={() => onRetry?.(message)}>
            Не отправилось. Повторить
          </button>
        ) : null}
      </div>
      {mine ? null : replyButton}
      {zoom ? <ImageLightbox key={zoom.src} zoom={zoom} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
