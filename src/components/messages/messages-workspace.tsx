import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CabinetNotice } from "@/components/cabinet";
import { ConversationList } from "@/components/messages/conversation-list";
import { useMessaging } from "@/components/messages/messages-live";
import { ConversationThread, type ThreadMessage } from "@/components/messages/conversation-thread";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  blockPairFn,
  closeConversationFn,
  listConversationsFn,
  listMessagesFn,
  markConversationReadFn,
  reopenConversationFn,
  reportMessageFn,
  sendMessageFn,
} from "@/lib/messages/functions";
import { CONVERSATION_POLL_MS, THREAD_POLL_MS, visiblePollInterval } from "@/lib/messages/polling";
import { DAILY_TRAINER_LIMIT_MESSAGE, type ConversationCursor, type ConversationListItem, type MessageCursor, type MessageDto } from "@/lib/messages/schemas";
import { useIsMobile } from "@/hooks/use-mobile";

function mergeById<T extends { id: string | number }>(first: T[], extra: T[]) {
  const seen = new Set(first.map((item) => item.id));
  return [...first, ...extra.filter((item) => !seen.has(item.id))];
}

export function MessagesWorkspace({
  view,
  conversationId,
  openError,
}: {
  view: "own" | "inbox";
  conversationId: string | null;
  openError?: string | null;
}) {
  const mobile = useIsMobile();
  const router = useRouter();
  const navigate = useNavigate();
  const trainerHold = useRouterState({
    select: (state) => {
      const trainer = (state.location.search as { trainer?: unknown }).trainer;
      return typeof trainer === "string" && trainer.length > 0;
    },
  });
  const messaging = useMessaging();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listConversationsFn);
  const messagesFn = useServerFn(listMessagesFn);
  const sendFn = useServerFn(sendMessageFn);
  const markFn = useServerFn(markConversationReadFn);
  const closeFn = useServerFn(closeConversationFn);
  const reopenFn = useServerFn(reopenConversationFn);
  const blockFn = useServerFn(blockPairFn);
  const reportFn = useServerFn(reportMessageFn);
  const [extraItems, setExtraItems] = useState<ConversationListItem[]>([]);
  const [listCursor, setListCursor] = useState<ConversationCursor | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [older, setOlder] = useState<MessageDto[]>([]);
  const [messageCursor, setMessageCursor] = useState<MessageCursor | null | undefined>(undefined);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [pending, setPending] = useState<ThreadMessage[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["conversations", view],
    queryFn: () => listFn({ data: { view } }),
    refetchInterval: visiblePollInterval(CONVERSATION_POLL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const threadQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => messagesFn({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
    refetchInterval: visiblePollInterval(THREAD_POLL_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setExtraItems([]);
    setListCursor(undefined);
  }, [view]);

  useEffect(() => {
    setOlder([]);
    setMessageCursor(undefined);
    setPending([]);
    setActionError(null);
  }, [conversationId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void listQuery.refetch();
      if (conversationId) void threadQuery.refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId, listQuery, threadQuery]);

  const scanned = useRef(messaging.total);
  useEffect(() => {
    if (scanned.current === messaging.total) return;
    scanned.current = messaging.total;
    void listQuery.refetch();
    if (conversationId) void threadQuery.refetch();
  }, [messaging.total, conversationId, listQuery, threadQuery]);

  const newestId = threadQuery.data?.messages[0]?.id ?? 0;
  const shouldMark = Boolean(
    threadQuery.data && (threadQuery.data.canWrite || threadQuery.data.canReport || threadQuery.data.canClose),
  );
  const markedKey = useRef("");
  useEffect(() => {
    if (!conversationId || !newestId || !shouldMark) return;
    const key = `${conversationId}:${newestId}`;
    if (markedKey.current === key) return;
    markedKey.current = key;
    void markFn({ data: { conversationId, lastMessageId: newestId } })
      .then(() => router.invalidate())
      .catch(() => undefined);
  }, [conversationId, newestId, shouldMark, markFn, router]);

  const items = useMemo(
    () => mergeById(listQuery.data?.items ?? [], extraItems),
    [listQuery.data?.items, extraItems],
  );
  const latestId = items[0]?.id ?? null;
  useEffect(() => {
    if (conversationId || openError || trainerHold || listQuery.isPending || !latestId) return;
    void navigate({
      to: view === "own" ? "/account/messages/$conversationId" : "/me/messages/$conversationId",
      params: { conversationId: latestId },
      replace: true,
    });
  }, [conversationId, openError, trainerHold, listQuery.isPending, latestId, view, navigate]);
  const nextListCursor = listCursor === undefined ? listQuery.data?.nextCursor ?? null : listCursor;
  const serverMessages = threadQuery.data?.messages ?? [];
  const confirmed = new Set(serverMessages.map((message) => message.clientId));
  const localPending = pending.filter((message) => !confirmed.has(message.clientId));
  const chronological = [
    ...older,
    ...serverMessages.slice().reverse(),
    ...localPending,
  ];
  const seen = new Set<string>();
  const messages = chronological.filter((message) => {
    const key = message.clientId || String(message.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const nextMessageCursor = messageCursor === undefined ? threadQuery.data?.nextCursor ?? null : messageCursor;

  async function send(body: string, clientId?: string) {
    if (!conversationId) return;
    const id = clientId ?? crypto.randomUUID();
    const optimistic: ThreadMessage = {
      id: -Date.now(),
      conversationId,
      senderId: "me",
      body,
      clientId: id,
      createdAt: new Date().toISOString(),
      deleted: false,
      mine: true,
      receipt: null,
      status: "sending",
    };
    setPending((current) => [...current.filter((item) => item.clientId !== id), optimistic]);
    setActionError(null);
    try {
      await sendFn({ data: { conversationId, body, clientId: id } });
      setPending((current) => current.filter((item) => item.clientId !== id));
      await threadQuery.refetch();
      await listQuery.refetch();
      void router.invalidate();
    } catch (error) {
      const message = authErrorMessage(error);
      if (message === DAILY_TRAINER_LIMIT_MESSAGE) {
        setPending((current) => current.filter((item) => item.clientId !== id));
        setActionError(message);
        setLimitOpen(true);
        return;
      }
      setPending((current) => current.map((item) => item.clientId === id ? { ...item, status: "failed" as const } : item));
      setActionError(message);
    }
  }

  async function run(action: () => Promise<unknown>, done?: string) {
    if (!conversationId) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      if (done) toast(done);
      await threadQuery.refetch();
      await listQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      void router.invalidate();
    } catch (error) {
      setActionError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const limitMessage = openError === DAILY_TRAINER_LIMIT_MESSAGE || actionError === DAILY_TRAINER_LIMIT_MESSAGE
    ? DAILY_TRAINER_LIMIT_MESSAGE
    : null;
  useEffect(() => {
    if (limitMessage) setLimitOpen(true);
  }, [limitMessage]);
  const shown = (message: string | null | undefined) => message === DAILY_TRAINER_LIMIT_MESSAGE ? null : message ?? null;
  const threadError = shown(openError) || shown(actionError) || (threadQuery.error ? shown(authErrorMessage(threadQuery.error)) : null);
  const listError = listQuery.error ? authErrorMessage(listQuery.error) : null;

  return (
    <div className={`direct${mobile ? " is-mobile" : ""}`}>
      <ConversationList
        view={view}
        items={items}
        activeId={conversationId}
        loading={listQuery.isPending}
        error={listError}
        hasMore={Boolean(nextListCursor)}
        loadingMore={loadingMore}
        onMore={() => {
          if (!nextListCursor) return;
          setLoadingMore(true);
          void listFn({ data: { view, cursor: nextListCursor } })
            .then((page) => {
              setExtraItems((current) => mergeById(current, page.items));
              setListCursor(page.nextCursor);
            })
            .catch((error) => setActionError(authErrorMessage(error)))
            .finally(() => setLoadingMore(false));
        }}
      />
      <ConversationThread
        view={view}
        thread={threadQuery.data ?? null}
        messages={messages}
        loading={Boolean(conversationId) && threadQuery.isPending}
        error={conversationId ? threadError : shown(openError)}
        hasEarlier={Boolean(nextMessageCursor)}
        loadingEarlier={loadingEarlier}
        onEarlier={() => {
          if (!conversationId || !nextMessageCursor) return;
          setLoadingEarlier(true);
          void messagesFn({ data: { conversationId, cursor: nextMessageCursor } })
            .then((page) => {
              setOlder((current) => [...page.messages.slice().reverse(), ...current]);
              setMessageCursor(page.nextCursor);
            })
            .catch((error) => setActionError(authErrorMessage(error)))
            .finally(() => setLoadingEarlier(false));
        }}
        onSend={(body) => send(body)}
        onRetry={(message) => void send(message.body, message.clientId)}
        onReport={async (messageId, reason) => {
          const result = await reportFn({ data: { messageId, reason } });
          toast(result.duplicate ? "Вы уже жаловались на это сообщение." : "Жалоба отправлена.");
        }}
        onClose={() => void run(() => closeFn({ data: { conversationId: conversationId! } }), "Переписка закрыта")}
        onReopen={() => void run(() => reopenFn({ data: { conversationId: conversationId! } }))}
        onBlock={() => void run(() => blockFn({ data: { conversationId: conversationId! } }), "Пара заблокирована, диалог закрыт")}
        busy={busy}
      />
      {limitOpen && limitMessage ? (
        <CabinetNotice
          title="Лимит на сегодня"
          message={limitMessage}
          onClose={() => setLimitOpen(false)}
        />
      ) : null}
      <style>{DIRECT_CSS}</style>
    </div>
  );
}

export const DIRECT_CSS = `
.direct { display: grid; grid-template-columns: 1fr; grid-template-rows: minmax(180px, 34vh) minmax(320px, 1fr); min-height: 70vh; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); overflow: hidden; }
.direct-list, .direct-thread { min-width: 0; min-height: 0; }
.direct-list { display: flex; flex-direction: column; border-bottom: 1px solid var(--line); }
.direct-list h2 { margin: 0; padding: 14px 16px; font-size: 16px; color: var(--dark); }
.direct-list ul { list-style: none; margin: 0; padding: 0; overflow: auto; }
.direct-list a { display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 8px 12px; color: inherit; text-decoration: none; transition: background-color 0.15s ease; }
.direct-list a:hover { background: rgba(var(--dark-rgb), 0.04); }
.direct-list a:hover .trainer-name__line { color: var(--primary); }
.direct-list a.is-active { background: rgba(var(--primary-rgb), 0.08); }
.direct-list a.is-active:hover { background: rgba(var(--primary-rgb), 0.14); }
.direct-list a.is-active .trainer-name__line { color: var(--primary); }
.direct-list__text { display: grid; min-width: 0; flex: 1; }
.direct-list__text strong { color: var(--dark); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.direct-list .trainer-name,
.direct-thread__head .trainer-name { flex-direction: row; flex-wrap: nowrap; gap: 0.35em; }
.direct-list .trainer-name__line,
.direct-thread__head .trainer-name__line { display: inline; width: auto; overflow: visible; text-overflow: clip; white-space: nowrap; }
.direct-list__text em { color: var(--muted); font-style: normal; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.direct-list__meta { display: grid; justify-items: end; gap: 4px; color: var(--muted); font-size: 12px; }
.direct-unread { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 11px; font-weight: var(--fw-title); line-height: 20px; text-align: center; }
.direct-thread { display: flex; flex-direction: column; }
.direct-thread__head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.direct-thread__head strong, .direct-thread__head a { color: var(--dark); font-weight: var(--fw-title); text-decoration: none; }
.direct-thread__head span:not(.trainer-name):not(.trainer-name__line) { display: block; color: var(--muted); font-size: 13px; }
.direct-thread__head .trainer-name__line { color: var(--dark); font-size: inherit; }
.direct-thread__head > div:nth-child(2), .direct-thread__head > div:first-child + div { min-width: 0; }
.direct-thread__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.direct-thread__actions button, .direct-back, .direct-more, .direct-composer__send, .direct-report, .direct-bubble__retry, .direct-report-form button {
  min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
}
.direct-back { margin-right: 4px; }
.direct-log { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.direct-day { align-self: center; margin: 8px 0; color: var(--muted); font-size: 12px; }
.direct-row { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 100%; }
.direct-row.is-mine { align-items: flex-end; }
.direct-bubble { max-width: min(100%, 460px); padding: 10px 12px; border-radius: 16px; background: var(--neutral-bg); color: var(--dark); }
.direct-bubble.is-mine { background: var(--primary); color: #fff; }
.direct-bubble p, .direct-bubble__text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: inherit; }
.direct-bubble .review-html, .direct-bubble .review-html p, .direct-bubble .review-html a { color: inherit; }
.direct-bubble .review-html p { margin: 0; }
.direct-bubble .review-html ul, .direct-bubble .review-html ol { margin: 4px 0; padding-left: 1.2em; }
.direct-bubble__meta { display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; margin-top: 4px; }
.direct-bubble__meta time, .direct-bubble__meta .direct-bubble__state { margin: 0; font-size: 11px; opacity: 0.85; }
.direct-bubble.is-deleted { opacity: 0.7; font-style: italic; }
.direct-report, .direct-bubble__retry { min-height: 44px; border: 0; background: transparent; color: var(--muted); padding: 0 4px; }
.direct-composer { width: 100%; padding: 0; border-top: 1px solid var(--line); }
.direct-composer__box { width: 100%; border: 0; border-radius: 0; background: var(--white); overflow: hidden; }
.direct-editor, .direct-editor .rsw-editor { width: 100%; border: 0; border-radius: 0; min-height: 0; box-shadow: none; }
.direct-composer__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; border-top: 1px solid var(--line); background: var(--light-bg); }
.direct-composer__send { margin-left: auto; background: var(--primary); color: #fff; border-color: transparent; }
.direct-composer__send:disabled, .direct-thread__actions button:disabled { opacity: 0.55; cursor: default; }
.direct-composer__count, .direct-composer__hint, .direct-empty { margin: 0; color: var(--muted); font-size: 13px; }
.direct-composer__hint { margin: 0; padding: 8px 12px 0; }
.direct-composer__count.is-over { color: var(--primary); }
.direct-empty { padding: 16px; }
.direct-skeletons { display: grid; gap: 10px; padding: 16px; }
.direct-skeletons span { display: block; height: 52px; border-radius: 12px; background: linear-gradient(90deg, var(--neutral-bg), var(--line), var(--neutral-bg)); background-size: 200% 100%; animation: direct-pulse 1.2s ease infinite; }
@keyframes direct-pulse { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.direct-report-form { display: grid; gap: 12px; }
.direct-report-form select { min-height: 44px; width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 0 12px; font: inherit; background: var(--white); }
.direct-more { margin: 8px auto; }
@media (min-width: 768px) {
  .direct:not(.is-mobile) { grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); grid-template-rows: minmax(560px, 70vh); }
  .direct:not(.is-mobile) .direct-list { border-bottom: 0; border-right: 1px solid var(--line); }
}
.direct.is-mobile { grid-template-columns: 1fr; grid-template-rows: minmax(180px, 34vh) minmax(320px, 1fr); }
.direct.is-mobile .direct-list { border-right: 0; border-bottom: 1px solid var(--line); }
`;
