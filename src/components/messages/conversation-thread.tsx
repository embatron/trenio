import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer, type ComposerFile } from "@/components/messages/message-composer";
import { PresenceDot } from "@/components/messages/presence-dot";
import { TrainerName } from "@/components/trainer-name";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { notifyTyping, remoteTyping, subscribeTyping } from "@/lib/messages/live-client";
import { REPORT_COMMENT_MAX_LENGTH, REPORT_REASONS, messagePreview, type MessageDto, type ThreadResult } from "@/lib/messages/schemas";
import { firstUnreadMessageId, messageScrollTop, seenMessageId } from "@/lib/messages/thread-scroll";

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

function OpenProfile({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      className={`cabinet-id__line${className ? ` ${className}` : ""}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Открыть публичный профиль"
    >
      <strong>{children}</strong>
      <span className="cabinet-id__open" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M14 5h5v5" />
          <path d="M13 11l6-6" />
          <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      </span>
    </a>
  );
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
  onEdit,
  onLike,
  onRetry,
  onReport,
  onBlock,
  onUnblock,
  onDelete,
  busy,
  onBack,
  onDismiss,
  onPrevious,
  onNext,
  onSeen,
}: {
  view: "own" | "inbox";
  thread: ThreadResult | null;
  messages: ThreadMessage[];
  loading: boolean;
  error: string | null;
  hasEarlier: boolean;
  loadingEarlier: boolean;
  onEarlier: () => void;
  onSend: (body: string, files: ComposerFile[], replyToId?: number) => Promise<void>;
  onEdit: (messageId: number, body: string) => Promise<void>;
  onLike?: (messageId: number) => void;
  onRetry: (message: ThreadMessage) => void;
  onReport: (reason: (typeof REPORT_REASONS)[number]["id"], comment: string) => Promise<void>;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  busy: boolean;
  onBack?: () => void;
  onDismiss?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Latest message whose bottom has entered the visible log. */
  onSeen?: (messageId: number) => void;
}) {
  const mobile = useIsMobile();
  const threadRoot = useRef<HTMLDivElement>(null);
  const [, setTypingTick] = useState(0);
  useEffect(() => subscribeTyping(() => setTypingTick((value) => value + 1)), []);
  const typing = Boolean(thread?.conversationId && remoteTyping(thread.conversationId));
  const liveConversationId = thread?.conversationId ?? null;
  useEffect(() => {
    if (!liveConversationId) return;
    return () => notifyTyping(liveConversationId, false);
  }, [liveConversationId]);
  const knownFor = useRef("");
  const seenKeys = useRef(new Set<string>());
  const freshKeys = useRef(new Set<string>());
  const [reply, setReply] = useState<{ id: number; preview: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  useEffect(() => {
    setReply(null);
    setEditing(null);
  }, [thread?.conversationId]);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["id"]>(REPORT_REASONS[0].id);
  const [comment, setComment] = useState("");
  const commentLength = reviewTextLength(comment);
  const commentOver = commentLength > REPORT_COMMENT_MAX_LENGTH;
  const [reporting, setReporting] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  const reportSeen = () => {
    const el = scroller.current;
    const report = onSeenRef.current;
    if (!el || !report || el.clientHeight < 1) return;
    const edge = el.getBoundingClientRect().bottom;
    const rows = [...el.querySelectorAll("[data-message-id]")].flatMap((node) => {
      if (!(node instanceof HTMLElement)) return [];
      const id = Number(node.dataset.messageId);
      if (!Number.isFinite(id)) return [];
      return [{ id, bottom: node.getBoundingClientRect().bottom }];
    });
    const seen = seenMessageId(rows, edge);
    if (seen != null) report(seen);
  };
  const stick = useRef(true);
  const released = useRef(false);
  const placedFor = useRef<string | null>(null);
  const cursorFor = useRef<string | null>(null);
  const readAtOpen = useRef<number | null>(null);
  const followedId = useRef<number | null>(null);
  const heightTries = useRef(0);
  const [scrollEpoch, setScrollEpoch] = useState(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const lastId = messages[messages.length - 1]?.id;
  const lastClient = messages[messages.length - 1]?.clientId;
  const lastMine = messages[messages.length - 1]?.mine ?? false;
  const conversationId = thread?.conversationId ?? null;
  const messageCount = messages.length;

  useLayoutEffect(() => {
    const header = document.querySelector(".site-header");
    if (!(header instanceof HTMLElement)) return;
    const apply = () => {
      document.documentElement.style.setProperty("--direct-top", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--direct-top");
    };
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    const current = threadRef.current;
    if (!el || !current) return;
    const rows = messagesRef.current;
    if (rows.some((message) => message.conversationId !== current.conversationId)) return;
    if (cursorFor.current !== current.conversationId) {
      cursorFor.current = current.conversationId;
      readAtOpen.current = current.viewerReadMessageId;
      released.current = false;
      heightTries.current = 0;
    }
    if (el.clientHeight < 1) {
      if (heightTries.current >= 8) return;
      heightTries.current += 1;
      const frame = requestAnimationFrame(() => setScrollEpoch((value) => value + 1));
      return () => cancelAnimationFrame(frame);
    }
    heightTries.current = 0;

    const alreadyPlaced = placedFor.current === current.conversationId;
    const ownSend = alreadyPlaced && lastMine && followedId.current !== (lastId ?? null);
    if (ownSend) {
      released.current = true;
      const top = Math.max(0, el.scrollHeight - el.clientHeight);
      if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
      stick.current = true;
      followedId.current = lastId ?? null;
      reportSeen();
      return;
    }
    if (released.current && !stick.current) {
      followedId.current = lastId ?? null;
      reportSeen();
      return;
    }

    const boundary = released.current ? followedId.current : readAtOpen.current;
    const anchorId = firstUnreadMessageId(rows, boundary, current.canMarkRead);
    const anchor = anchorId == null ? null : el.querySelector(`[data-message-id="${anchorId}"]`);
    const anchorTop = anchor instanceof HTMLElement
      ? anchor.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
      : null;
    const place = messageScrollTop({
      anchorTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
    el.scrollTop = place.top;
    stick.current = place.stick;
    placedFor.current = current.conversationId;
    followedId.current = lastId ?? null;
    reportSeen();
  }, [conversationId, messageCount, lastId, lastClient, lastMine, scrollEpoch]);

  useEffect(() => {
    const root = threadRoot.current?.closest(".direct");
    if (!(root instanceof HTMLElement)) return;
    const done = (event: AnimationEvent) => {
      if (event.target !== root) return;
      reportSeen();
    };
    root.addEventListener("animationend", done);
    return () => root.removeEventListener("animationend", done);
  }, [conversationId]);

  useEffect(() => {
    const el = scroller.current;
    const thread = el?.closest(".direct-thread");
    if (!el || !(thread instanceof HTMLElement)) return;
    const pin = () => {
      if (!stick.current) return;
      const top = Math.max(0, el.scrollHeight - el.clientHeight);
      if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
      reportSeen();
    };
    const observer = new ResizeObserver(pin);
    observer.observe(thread);
    const box = new ResizeObserver(() => reportSeen());
    box.observe(el);
    return () => {
      observer.disconnect();
      box.disconnect();
    };
  }, [conversationId]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onLoad = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement) || released.current) return;
      setScrollEpoch((value) => value + 1);
    };
    el.addEventListener("load", onLoad, true);
    return () => el.removeEventListener("load", onLoad, true);
  }, [conversationId]);

  useEffect(() => {
    if (!mobile || !conversationId) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const apply = () => {
      const raw = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const inset = raw > 80 ? Math.round(raw) : 0;
      if (inset > 0) {
        root.style.setProperty("--keyboard-inset", `${inset}px`);
        root.style.setProperty("--keyboard-pad", "0px");
      } else {
        root.style.removeProperty("--keyboard-inset");
        root.style.removeProperty("--keyboard-pad");
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    apply();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--keyboard-pad");
    };
  }, [mobile, conversationId]);

  useEffect(() => {
    if (!mobile || !onBack) return;
    const el = threadRoot.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const down = (event: PointerEvent) => {
      if (event.clientX > 28) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = event.clientX - startX;
      const dy = Math.abs(event.clientY - startY);
      if (dx > 72 && dy < 48) onBack();
    };
    const cancel = () => {
      tracking = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [mobile, onBack, conversationId]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const listPath = view === "own" ? "/account/messages" : "/me/messages";
  const hint = thread && !thread.canWrite
      ? thread.blocked
        ? "Сообщения в этом диалоге остановлены. Другие диалоги не затронуты."
        : thread.status === "closed"
          ? "Переписка закрыта. Новые сообщения не отправляются."
          : "Сейчас нельзя отправить сообщение."
      : null;

  const profileHref = thread?.counterpart.href ?? null;
  const trainerCardHref = thread?.counterpart.kind === "user" ? thread.trainerHref : null;
  const showMenu = Boolean(thread && (thread.canBlock || thread.canReport || thread.canDelete));
  const name = thread ? (
    <TrainerName firstName={thread.counterpart.firstName} lastName={thread.counterpart.lastName} empty={thread.counterpart.name} />
  ) : null;

  return (
    <div className="direct-thread" ref={threadRoot}>
      {!thread && loading ? (
        <div className="direct-skeletons" aria-hidden="true"><span /><span /><span /></div>
      ) : error ? (
        <p className="direct-empty">{error}</p>
      ) : !thread ? null : (
        <>
          <header className="direct-thread__head">
            {mobile && onBack ? (
              <button type="button" className="direct-back" onClick={onBack} aria-label="К списку">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                </svg>
                <span className="direct-back__label">К списку</span>
              </button>
            ) : mobile ? (
              <Link to={listPath} className="direct-back" aria-label="К списку">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                </svg>
                <span className="direct-back__label">К списку</span>
              </Link>
            ) : null}
            <div className="direct-thread__identity">
              {profileHref ? (
                <a className="direct-person__face presence-face" href={profileHref} target="_blank" rel="noopener noreferrer" aria-label={thread.counterpart.name}>
                  <UserAvatar name={thread.counterpart.name} src={thread.counterpart.avatarPath || null} size={44} />
                  <PresenceDot presence={thread.counterpart.presence ?? "offline"} />
                </a>
              ) : (
                <span className="presence-face">
                  <UserAvatar name={thread.counterpart.name} src={thread.counterpart.avatarPath || null} size={44} />
                  <PresenceDot presence={thread.counterpart.presence ?? "offline"} />
                </span>
              )}
              <div className="direct-thread__who">
                {profileHref ? (
                  <OpenProfile href={profileHref}>{name}</OpenProfile>
                ) : (
                  <strong>{name}</strong>
                )}
                {trainerCardHref ? (
                  <OpenProfile className="direct-thread__trainer" href={trainerCardHref}>
                    Тренер: {thread.trainerName}
                  </OpenProfile>
                ) : null}
                {typing ? <p className="direct-thread__typing" aria-live="polite">печатает…</p> : null}
              </div>
            </div>
            <div className="direct-thread__actions">
              {onPrevious || onNext ? (
                <div className="direct-switch" role="group" aria-label="Соседние диалоги">
                  <button type="button" className="direct-icon" aria-label="Предыдущий диалог" disabled={!onPrevious || busy} onClick={onPrevious}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M6 14l6-6 6 6" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                    </svg>
                  </button>
                  <button type="button" className="direct-icon" aria-label="Следующий диалог" disabled={!onNext || busy} onClick={onNext}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M6 10l6 6 6-6" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                    </svg>
                  </button>
                </div>
              ) : null}
              {showMenu ? (
                <div className="direct-menu" ref={moreRef}>
                  <button
                    type="button"
                    className="direct-menu__btn"
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    aria-label="Ещё"
                    onClick={() => setMoreOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M6 12h.01M12 12h.01M18 12h.01" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round" }} />
                    </svg>
                  </button>
                  {moreOpen ? (
                    <div className="direct-menu__list" role="menu">
                      {thread.canReport ? (
                        <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setReportOpen(true); }}>
                          Пожаловаться
                        </button>
                      ) : null}
                      {thread.canBlock && !thread.blocked ? (
                        <button type="button" role="menuitem" disabled={busy} onClick={() => { setMoreOpen(false); setBlockOpen(true); }}>
                          Заблокировать
                        </button>
                      ) : null}
                      {thread.canDelete ? (
                        <button type="button" role="menuitem" disabled={busy} onClick={() => { setMoreOpen(false); setDeleteOpen(true); }}>
                          Удалить диалог
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!mobile && onDismiss ? (
                <button type="button" className="direct-icon" aria-label="Закрыть" title="Закрыть" onClick={onDismiss}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" style={{ fill: "none", stroke: "currentColor", strokeWidth: "var(--icon-stroke)", strokeLinecap: "round", strokeLinejoin: "round" }} />
                  </svg>
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
          <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Заблокировать переписку</DialogTitle>
              </DialogHeader>
              <form
                className="direct-report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy) return;
                  setBlockOpen(false);
                  onBlock();
                }}
              >
                <p className="direct-report-form__note">
                  {thread?.canReport
                    ? thread.counterpart.kind === "user"
                      ? `${thread.counterpart.name} не сможет писать вам, и вы не сможете писать в этот диалог. Аккаунт останется активным для других тренеров.`
                      : `Вы и ${thread.counterpart.name} больше не сможете писать в этот диалог. Остальные диалоги останутся открыты.`
                    : "Сообщения между участниками этого диалога остановятся. Остальные диалоги останутся открыты."}
                </p>
                <div className="direct-report-form__actions">
                  <button type="button" onClick={() => setBlockOpen(false)}>Отмена</button>
                  <button type="submit" className="direct-report-form__send" disabled={busy}>Заблокировать</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={unblockOpen} onOpenChange={setUnblockOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Разблокировать переписку</DialogTitle>
              </DialogHeader>
              <form
                className="direct-report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy) return;
                  setUnblockOpen(false);
                  onUnblock();
                }}
              >
                <p className="direct-report-form__note">
                  Вы и {thread.counterpart.name} снова сможете писать в этот диалог.
                </p>
                <div className="direct-report-form__actions">
                  <button type="button" onClick={() => setUnblockOpen(false)}>Отмена</button>
                  <button type="submit" className="direct-report-form__send" disabled={busy}>Разблокировать</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Удалить диалог</DialogTitle>
              </DialogHeader>
              <form
                className="direct-report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy) return;
                  setDeleteOpen(false);
                  onDelete();
                }}
              >
                <p className="direct-report-form__note">
                  Переписка пропадёт только у вас и исчезнет из списка. У {thread.counterpart.name} она останется.
                </p>
                <div className="direct-report-form__actions">
                  <button type="button" onClick={() => setDeleteOpen(false)}>Отмена</button>
                  <button type="submit" className="direct-report-form__send" disabled={busy}>Удалить</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <div key={thread.conversationId} className="direct-thread__pane">
            {thread.blocked && thread.canBlock ? (
              <button type="button" className="direct-unblock" onClick={() => setUnblockOpen(true)}>
                Разблокировать
              </button>
            ) : null}
          <div
            className="direct-log"
            ref={scroller}
            onScroll={(event) => {
              if (!event.nativeEvent.isTrusted) return;
              const el = event.currentTarget;
              released.current = true;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              reportSeen();
            }}
          >
            {hasEarlier ? (
              <button type="button" className="direct-more" onClick={onEarlier} disabled={loadingEarlier}>
                {loadingEarlier ? "Загрузка…" : "Более ранние сообщения"}
              </button>
            ) : null}
            {messages.length === 0 && !thread.deletedByCounterpart ? <p className="direct-empty">Напишите первое сообщение</p> : null}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const split = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
              const quoted = messages.some((item) => item.replyTo?.id === message.id);
              const key = message.clientId || String(message.id);
              if (knownFor.current !== (thread?.conversationId ?? "")) {
                knownFor.current = thread?.conversationId ?? "";
                seenKeys.current = new Set(messages.map((item) => item.clientId || String(item.id)));
                freshKeys.current = new Set();
              }
              if (!seenKeys.current.has(key)) {
                seenKeys.current.add(key);
                freshKeys.current.add(key);
              }
              const canLike = Boolean(onLike) && thread?.canMarkRead && !message.mine && !message.deleted && !message.status && message.id > 0;
              return (
                <div key={key} className={freshKeys.current.has(key) ? "is-arriving" : undefined} data-message-id={message.id}>
                  {split ? <p className="direct-day">{dayLabel(message.createdAt)}</p> : null}
                  <MessageBubble
                    message={message}
                    quoted={quoted}
                    onRetry={onRetry}
                    onLike={canLike ? () => onLike?.(message.id) : undefined}
                    onQuote={thread?.canWrite && !message.deleted && !message.status ? () => {
                      setEditing(null);
                      setReply({ id: message.id, preview: messagePreview(message.body) || "Вложение" });
                    } : undefined}
                    onEdit={thread?.canWrite && message.canEdit && message.body && !message.status ? () => {
                      setReply(null);
                      setEditing({ id: message.id, body: message.body });
                    } : undefined}
                    onFocusQuote={(id) => {
                      const node = threadRoot.current?.querySelector(`[data-message-id="${id}"]`);
                      if (!(node instanceof HTMLElement)) return;
                      node.scrollIntoView({ block: "center", behavior: "smooth" });
                    }}
                  />
                </div>
              );
            })}
            {thread.deletedByCounterpart ? <p className="direct-cleared">Переписка была удалена пользователем</p> : null}
          </div>
          <MessageComposer
            key={`${thread.conversationId}:${editing?.id ?? "new"}`}
            limit={thread.composeLimit || 4000}
            disabled={!thread.canWrite || busy}
            hint={hint}
            editing={Boolean(editing)}
            initialHtml={editing?.body ?? ""}
            reply={reply}
            onCancelReply={() => setReply(null)}
            onCancelEdit={() => setEditing(null)}
            onActivity={(on) => notifyTyping(thread.conversationId, on)}
            onSend={async (body, files) => {
              notifyTyping(thread.conversationId, false);
              if (editing) {
                await onEdit(editing.id, body);
                setEditing(null);
                return;
              }
              await onSend(body, files, reply?.id);
              setReply(null);
            }}
          />
          </div>
        </>
      )}
    </div>
  );
}
