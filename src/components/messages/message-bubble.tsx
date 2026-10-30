import { useEffect, useState } from "react";

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
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
    </div>
  );
}

export function MessageBubble({
  message,
  pending,
  onRetry,
}: {
  message: MessageDto & {
    status?: "sending" | "failed";
    pendingNames?: string[];
    localFiles?: { url: string; name: string; kind: "image" | "file" }[];
  };
  pending?: boolean;
  onRetry?: (message: MessageDto) => void;
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

  return (
    <div className={`direct-row${mine ? " is-mine" : ""}`}>
      <div className={`direct-bubble is-${message.side}${mine ? " is-mine" : ""}${message.deleted ? " is-deleted" : ""}`}>
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
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
          {receipt ? <span className="direct-bubble__state">{receipt}</span> : null}
        </div>
        {failed ? (
          <button type="button" className="direct-bubble__retry" onClick={() => onRetry?.(message)}>
            Не отправилось. Повторить
          </button>
        ) : null}
      </div>
      {zoom ? <ImageLightbox key={zoom.src} zoom={zoom} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
