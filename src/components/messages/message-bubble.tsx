import { useState } from "react";

import { ReviewHtml } from "@/components/review-html";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REPORT_REASONS, type MessageDto } from "@/lib/messages/schemas";

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function MessageBubble({
  message,
  pending,
  canReport,
  onReport,
  onRetry,
}: {
  message: MessageDto & { status?: "sending" | "failed" };
  pending?: boolean;
  canReport: boolean;
  onReport: (messageId: number, reason: string) => Promise<void>;
  onRetry?: (message: MessageDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].label);
  const [busy, setBusy] = useState(false);
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
      <div className={`direct-bubble${mine ? " is-mine" : ""}${message.deleted ? " is-deleted" : ""}`}>
        {message.deleted ? <p>Сообщение удалено</p> : <ReviewHtml className="direct-bubble__text" html={message.body} />}
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
      {!mine && !message.deleted && canReport && message.id > 0 ? (
        <>
          <button type="button" className="direct-report" onClick={() => setOpen(true)}>
            Пожаловаться
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Пожаловаться на сообщение</DialogTitle>
              </DialogHeader>
              <form
                className="direct-report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setBusy(true);
                  void onReport(message.id, reason)
                    .then(() => setOpen(false))
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  Причина
                  <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    {REPORT_REASONS.map((item) => (
                      <option key={item.id} value={item.label}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={busy}>{busy ? "Отправка…" : "Отправить жалобу"}</button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
