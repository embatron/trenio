import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer, type ComposerFile } from "@/components/messages/message-composer";
import { TrainerName } from "@/components/trainer-name";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { REPORT_COMMENT_MAX_LENGTH, REPORT_REASONS, type MessageDto, type ThreadResult } from "@/lib/messages/schemas";

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86_400_000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export type ThreadMessage = MessageDto & {
  status?: "sending" | "failed";
  pendingNames?: string[];
  localFiles?: ComposerFile[];
};

export function ConversationThread({
  view,
  thread,
  messages,
  loading,
  error,
  hasEarlier,
  loadingEarlier,
  onEarlier,
  onSend,
  onRetry,
  onReport,
  onClose,
  onReopen,
  onBlock,
  busy,
}: {
  view: "own" | "inbox";
  thread: ThreadResult | null;
  messages: ThreadMessage[];
  loading: boolean;
  error: string | null;
  hasEarlier: boolean;
  loadingEarlier: boolean;
  onEarlier: () => void;
  onSend: (body: string, files: ComposerFile[]) => Promise<void>;
  onRetry: (message: ThreadMessage) => void;
  onReport: (reason: (typeof REPORT_REASONS)[number]["id"], comment: string) => Promise<void>;
  onClose: () => void;
  onReopen: () => void;
  onBlock: () => void;
  busy: boolean;
}) {
  const mobile = useIsMobile();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["id"]>(REPORT_REASONS[0].id);
  const [comment, setComment] = useState("");
  const commentLength = reviewTextLength(comment);
  const commentOver = commentLength > REPORT_COMMENT_MAX_LENGTH;
  const [reporting, setReporting] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const opened = useRef<string | null>(null);
  const lastId = messages[messages.length - 1]?.id;
  const lastClient = messages[messages.length - 1]?.clientId;
  const lastMine = messages[messages.length - 1]?.mine ?? false;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const firstOpen = opened.current !== (thread?.conversationId ?? null);
    if (firstOpen) opened.current = thread?.conversationId ?? null;
    if (firstOpen || stick.current || lastMine) el.scrollTop = el.scrollHeight;
  }, [thread?.conversationId, messages.length, lastId, lastClient, lastMine]);

  const listPath = view === "own" ? "/account/messages" : "/me/messages";
  const hint = thread && !thread.canWrite
      ? thread.status === "closed"
        ? "Переписка закрыта. Новые сообщения не отправляются."
        : "Сейчас нельзя отправить сообщение."
      : null;

  return (
    <div className="direct-thread">
      {!thread && loading ? (
        <div className="direct-skeletons" aria-hidden="true"><span /><span /><span /></div>
      ) : error ? (
        <p className="direct-empty">{error}</p>
      ) : !thread ? null : (
        <>
          <header className="direct-thread__head">
            {mobile ? (
              <Link to={listPath} className="direct-back">К списку</Link>
            ) : null}
            <UserAvatar name={thread.counterpart.name} src={thread.counterpart.avatarPath || null} size={44} />
            <div className="direct-thread__who">
              {thread.counterpart.slug ? (
                <Link to="/trainers/$slug" params={{ slug: thread.counterpart.slug }}>
                  <TrainerName firstName={thread.counterpart.firstName} lastName={thread.counterpart.lastName} empty={thread.counterpart.name} />
                </Link>
              ) : (
                <strong>
                  <TrainerName firstName={thread.counterpart.firstName} lastName={thread.counterpart.lastName} empty={thread.counterpart.name} />
                </strong>
              )}
              {thread.counterpart.kind === "user" ? <span>Тренер: {thread.trainerName}</span> : null}
            </div>
            <div className="direct-thread__actions">
              {thread.canClose && thread.status === "open" ? (
                <button type="button" className="direct-icon" onClick={onClose} disabled={busy} aria-label="Закрыть переписку" title="Закрыть переписку">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                  </svg>
                </button>
              ) : null}
              {thread.canReopen && thread.status === "closed" ? <button type="button" onClick={onReopen} disabled={busy}>Открыть</button> : null}
              {thread.canBlock ? <button type="button" onClick={onBlock} disabled={busy}>Заблокировать</button> : null}
              {thread.canReport ? (
                <button type="button" className="direct-report" onClick={() => setReportOpen(true)} aria-label="Пожаловаться на переписку" title="Пожаловаться на переписку">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V4" /><path d="M6 4h10l-2.2 3.2L16 10.4H6" /></svg>
                </button>
              ) : null}
            </div>
          </header>
          <Dialog
            open={reportOpen}
            onOpenChange={(open) => {
              setReportOpen(open);
              if (!open) {
                setComment("");
                setReason(REPORT_REASONS[0].id);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Пожаловаться на переписку</DialogTitle>
              </DialogHeader>
              <form
                className="direct-report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!comment.trim() || commentOver) return;
                  setReporting(true);
                  void onReport(reason, comment.trim())
                    .then(() => setReportOpen(false))
                    .finally(() => setReporting(false));
                }}
              >
                <label>
                  Причина
                  <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
                    {REPORT_REASONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Комментарий
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={thread.counterpart.kind === "user" ? "Опишите ситуацию со своей стороны" : "Опишите, что случилось"}
                    maxLength={2000}
                    required
                  />
                </label>
                <p className={commentOver ? "is-over" : undefined}>{commentLength}/{REPORT_COMMENT_MAX_LENGTH}</p>
                <button type="submit" className="direct-report-form__send" disabled={reporting || !comment.trim() || commentOver}>
                  {reporting ? "Отправка…" : "Отправить"}
                </button>
              </form>
            </DialogContent>
          </Dialog>
          <div
            className="direct-log"
            ref={scroller}
            onScroll={(event) => {
              const el = event.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {hasEarlier ? (
              <button type="button" className="direct-more" onClick={onEarlier} disabled={loadingEarlier}>
                {loadingEarlier ? "Загрузка…" : "Более ранние сообщения"}
              </button>
            ) : null}
            {messages.length === 0 ? <p className="direct-empty">Напишите первое сообщение</p> : null}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const split = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
              return (
                <div key={message.clientId || message.id}>
                  {split ? <p className="direct-day">{dayLabel(message.createdAt)}</p> : null}
                  <MessageBubble message={message} onRetry={onRetry} />
                </div>
              );
            })}
          </div>
          <MessageComposer
            limit={thread.composeLimit || 4000}
            disabled={!thread.canWrite || busy}
            hint={hint}
            onSend={onSend}
          />
        </>
      )}
    </div>
  );
}
