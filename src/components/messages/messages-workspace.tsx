import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CabinetNotice } from "@/components/cabinet";
import { ConversationList } from "@/components/messages/conversation-list";
import { useMessaging, useNoteMessagesRead, useRefreshMessages } from "@/components/messages/messages-live";
import { ConversationThread, type ThreadMessage } from "@/components/messages/conversation-thread";
import type { ComposerFile } from "@/components/messages/message-composer";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  blockPairFn,
  deleteConversationFn,
  unblockPairFn,
  editMessageFn,
  listConversationsFn,
  listMessagesFn,
  markConversationReadFn,
  reportMessageFn,
  sendMessageFn,
  uploadMessageFileFn,
} from "@/lib/messages/functions";
import { newMessageClientId } from "@/lib/messages/attachments";
import { DAILY_TRAINER_LIMIT_MESSAGE, type ConversationCursor, type ConversationListItem, type MessageCursor, type MessageDto } from "@/lib/messages/schemas";
import { useIsMobile } from "@/hooks/use-mobile";

const quietLists = new Set<string>();

const PHONE_SHEET = "(max-width: 767px)";

/**
 * The phone back button follows browser history. A dialog opened from a profile,
 * a notification, or a fresh tab has no list entry under it, so back leaves the
 * messages page. Put the dialog list behind the current entry without a render:
 * the history patch notifies the router, so this uses the original methods.
 */
function placeDialogListBehind(listPath: string) {
  const threadHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname === listPath || !threadHref.startsWith(`${listPath}/`)) return;
  const state = window.history.state;
  if (!state || typeof state !== "object" || state.messagesListBehind) return;
  const index = typeof state.__TSR_index === "number" ? state.__TSR_index : 0;
  const listKey = `dialogs-${state.key ?? index}`;
  History.prototype.replaceState.call(window.history, {
    ...state,
    __TSR_index: index - 1,
    key: listKey,
    __TSR_key: listKey,
  }, "", listPath);
  History.prototype.pushState.call(window.history, { ...state, messagesListBehind: true }, "", threadHref);
}

function mergeById<T extends { id: string | number }>(first: T[], extra: T[]) {
  const seen = new Set(first.map((item) => item.id));
  return [...first, ...extra.filter((item) => !seen.has(item.id))];
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Файл не прочитан."));
    reader.readAsDataURL(file);
  });
}

export function MessagesWorkspace({
  view,
  conversationId,
  openError,
  holdOpen = false,
}: {
  view: "own" | "inbox";
  conversationId: string | null;
  openError?: string | null;
  /** A card click is still resolving its own dialog. Do not open the newest row. */
  holdOpen?: boolean;
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
  const noteRead = useNoteMessagesRead();
  const refreshMessages = useRefreshMessages();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listConversationsFn);
  const messagesFn = useServerFn(listMessagesFn);
  const sendFn = useServerFn(sendMessageFn);
  const editFn = useServerFn(editMessageFn);
  const uploadFn = useServerFn(uploadMessageFileFn);
  const markFn = useServerFn(markConversationReadFn);
  const blockFn = useServerFn(blockPairFn);
  const deleteFn = useServerFn(deleteConversationFn);
  const unblockFn = useServerFn(unblockPairFn);
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["conversations", view, search],
    queryFn: () => listFn({ data: { view, query: search.length >= 2 ? search : undefined } }),
    placeholderData: (previous) => previous,
  });
  const threadQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => messagesFn({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    setExtraItems([]);
    setListCursor(undefined);
  }, [view, search]);

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
    const presenceTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void listQuery.refetch();
    }, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(presenceTimer);
    };
  }, [conversationId, listQuery, threadQuery]);

  const scanned = useRef(messaging.total);
  useEffect(() => {
    if (scanned.current === messaging.total) return;
    scanned.current = messaging.total;
    void listQuery.refetch();
    if (conversationId) void threadQuery.refetch();
  }, [messaging.total, conversationId, listQuery, threadQuery]);

  const shouldMark = Boolean(threadQuery.data?.canMarkRead);
  const shouldMarkRef = useRef(shouldMark);
  shouldMarkRef.current = shouldMark;
  const markedUpTo = useRef(0);
  const markedFor = useRef("");
  const notedUnread = useRef<{ id: string; left: number } | null>(null);
  const itemsRef = useRef<ConversationListItem[]>([]);
  const chronologicalRef = useRef<ThreadMessage[]>([]);
  const markSeen = (messageId: number) => {
    if (!conversationId || !shouldMarkRef.current || messageId <= 0) return;
    if (markedFor.current !== conversationId) {
      markedFor.current = conversationId;
      markedUpTo.current = 0;
      notedUnread.current = null;
    }
    const left = chronologicalRef.current.filter((message) => !message.mine && message.id > messageId).length;
    if (!notedUnread.current) {
      const before = itemsRef.current.find((item) => item.id === conversationId)?.unread ?? left;
      notedUnread.current = { id: conversationId, left: before };
    }
    const drop = notedUnread.current.left - left;
    if (drop > 0) {
      notedUnread.current.left = left;
      noteRead(view === "own" ? "own" : "inbox", drop);
      queryClient.setQueriesData<{ items: ConversationListItem[] }>({ queryKey: ["conversations", view] }, (current) => {
        if (!current?.items) return current;
        return {
          ...current,
          items: current.items.map((item) => item.id === conversationId ? { ...item, unread: left } : item),
        };
      });
      setExtraItems((current) => current.map((item) => item.id === conversationId ? { ...item, unread: left } : item));
    }
    if (messageId <= markedUpTo.current) return;
    markedUpTo.current = messageId;
    void markFn({ data: { conversationId, lastMessageId: messageId } })
      .then(() => {
        refreshMessages();
        void queryClient.invalidateQueries({ queryKey: ["conversations", view] });
      })
      .catch(() => {
        if (markedUpTo.current === messageId) markedUpTo.current = 0;
        notedUnread.current = null;
        void router.invalidate();
        void queryClient.invalidateQueries({ queryKey: ["conversations", view] });
      });
  };

  const items = useMemo(
    () => mergeById(listQuery.data?.items ?? [], extraItems),
    [listQuery.data?.items, extraItems],
  );
  const latestId = items[0]?.id ?? null;
  useEffect(() => {
    if (quietLists.has(view) || mobile || conversationId || openError || holdOpen || trainerHold || listQuery.isPending || !latestId) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    void navigate({
      to: view === "own" ? "/account/messages/$conversationId" : "/me/messages/$conversationId",
      params: { conversationId: latestId },
      replace: true,
    });
  }, [mobile, conversationId, openError, holdOpen, trainerHold, listQuery.isPending, latestId, view, navigate]);
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
  itemsRef.current = items;
  chronologicalRef.current = messages;
  const nextMessageCursor = messageCursor === undefined ? threadQuery.data?.nextCursor ?? null : messageCursor;

  async function send(body: string, files: ComposerFile[] = [], clientId?: string, replyToId?: number) {
    if (!conversationId) return;
    const id = clientId ?? newMessageClientId();
    const optimistic: ThreadMessage = {
      id: -Date.now(),
      conversationId,
      senderId: "me",
      body,
      clientId: id,
      createdAt: new Date().toISOString(),
      deleted: false,
      mine: true,
      side: threadQuery.data?.counterpart.kind === "user" ? "trainer" : "user",
      receipt: null,
      editedAt: null,
      canEdit: false,
      replyTo: replyToId ? { id: replyToId, preview: "Цитата" } : null,
      attachments: [],
      pendingNames: files.map((file) => file.name),
      localFiles: files,
      status: "sending",
    };
    setPending((current) => [...current.filter((item) => item.clientId !== id), optimistic]);
    setActionError(null);
    try {
      const attachmentIds: string[] = [];
      for (const file of files) {
        const dataUrl = await readDataUrl(file.file);
        const saved = await uploadFn({
          data: { id: file.id, conversationId, clientId: id, fileName: file.name, dataUrl },
        });
        attachmentIds.push(saved.id);
      }
      await sendFn({ data: { conversationId, body, clientId: id, attachmentIds, replyToId } });
      const before = itemsRef.current.find((item) => item.id === conversationId)?.unread ?? 0;
      if (before > 0) {
        noteRead(view === "own" ? "own" : "inbox", before);
        notedUnread.current = { id: conversationId, left: 0 };
        queryClient.setQueriesData<{ items: ConversationListItem[] }>({ queryKey: ["conversations", view] }, (current) => {
          if (!current?.items) return current;
          return {
            ...current,
            items: current.items.map((item) => item.id === conversationId ? { ...item, unread: 0 } : item),
          };
        });
        setExtraItems((current) => current.map((item) => item.id === conversationId ? { ...item, unread: 0 } : item));
      }
      refreshMessages();
      await threadQuery.refetch();
      setPending((current) => current.filter((item) => item.clientId !== id));
      await listQuery.refetch();
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
  const threadPath = view === "own" ? "/account/messages/$conversationId" : "/me/messages/$conversationId";
  const listPath = view === "own" ? "/account/messages" : "/me/messages";
  const openedFromList = useRef(false);
  useLayoutEffect(() => {
    const phone = window.matchMedia(PHONE_SHEET).matches;
    if (!conversationId) {
      if (phone) openedFromList.current = true;
      return;
    }
    if (!phone || openedFromList.current || window.history.state?.messagesListBehind) return;
    placeDialogListBehind(listPath);
  }, [conversationId, listPath]);
  useEffect(() => {
    const thread = threadQuery.data;
    if (!conversationId || !thread || thread.conversationId !== conversationId || thread.listed) return;
    quietLists.add(view);
    void navigate({ to: listPath, replace: true });
  }, [conversationId, threadQuery.data, view, navigate, listPath]);
  const openAt = (id: string) => {
    void navigate({ to: threadPath, params: { conversationId: id }, search: {} });
  };
  const openIndex = conversationId ? items.findIndex((item) => item.id === conversationId) : -1;
  const previousId = openIndex > 0 ? items[openIndex - 1]?.id ?? null : null;
  const nextId = openIndex >= 0 && openIndex < items.length - 1 ? items[openIndex + 1]?.id ?? null : null;
  const shown = (message: string | null | undefined) => message === DAILY_TRAINER_LIMIT_MESSAGE ? null : message ?? null;
  const threadError = shown(openError) || shown(actionError) || (threadQuery.error ? shown(authErrorMessage(threadQuery.error)) : null);
  const listError = listQuery.error ? authErrorMessage(listQuery.error) : null;

  return (
    <div className={`direct${mobile ? " is-mobile" : ""}${conversationId ? " is-thread is-open" : ""}`}>
      <ConversationList
        view={view}
        items={items}
        activeId={conversationId}
        loading={listQuery.isPending && !listQuery.data}
        error={listError}
        hasMore={Boolean(nextListCursor)}
        loadingMore={loadingMore}
        query={searchInput}
        onQuery={setSearchInput}
        onMore={() => {
          if (!nextListCursor) return;
          setLoadingMore(true);
          void listFn({ data: { view, cursor: nextListCursor, query: search.length >= 2 ? search : undefined } })
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
        onSend={(body, files, replyToId) => send(body, files, undefined, replyToId)}
        onEdit={async (messageId, body) => {
          if (!conversationId) return;
          setActionError(null);
          try {
            await editFn({ data: { messageId, body } });
            await threadQuery.refetch();
            await listQuery.refetch();
          } catch (error) {
            setActionError(authErrorMessage(error));
            throw error;
          }
        }}
        onRetry={(message) => void send(message.body, message.localFiles ?? [], message.clientId, message.replyTo?.id)}
        onReport={async (reason, comment) => {
          if (!conversationId) return;
          const result = await reportFn({ data: { conversationId, reason, comment } });
          toast(result.duplicate ? "Вы уже жаловались на эту переписку." : "Жалоба отправлена. Администратор получит письмо.");
        }}
        onBlock={() => void run(() => blockFn({ data: { conversationId: conversationId! } }), "Сообщения в этом диалоге остановлены")}
        onUnblock={() => void run(() => unblockFn({ data: { conversationId: conversationId! } }), "Диалог снова открыт")}
        onDelete={() => {
          if (!conversationId || busy) return;
          setBusy(true);
          setActionError(null);
          void deleteFn({ data: { conversationId } })
            .then(async () => {
              toast("Диалог удалён");
              quietLists.add(view);
              await listQuery.refetch();
              void router.invalidate();
              await navigate({ to: listPath, replace: true });
            })
            .catch((error) => setActionError(authErrorMessage(error)))
            .finally(() => setBusy(false));
        }}
        busy={busy}
        onBack={mobile ? () => {
          if (router.history.length > 1) router.history.back();
          else void navigate({ to: listPath, replace: true });
        } : undefined}
        onDismiss={() => {
          quietLists.add(view);
          void navigate({ to: listPath, replace: true });
        }}
        onPrevious={previousId ? () => openAt(previousId) : undefined}
        onNext={nextId ? () => openAt(nextId) : undefined}
        onSeen={markSeen}
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
.cabinet-card:has(> .direct) { overflow: hidden; }
.cabinet-card > .direct { border: 0; border-radius: 0; background: transparent; }
.direct-list, .direct-thread { min-width: 0; min-height: 0; }
.direct-list { display: flex; flex-direction: column; border-bottom: 1px solid var(--line); }
.direct-list h2 { margin: 0; padding: 14px 16px 8px; font-size: 16px; color: var(--dark); }
.direct-search { display: grid; gap: 4px; margin: 0 12px 8px; }
.direct-search__label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.direct-search input { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; padding: 0 12px; background: var(--white); color: var(--dark); font: inherit; font-size: 16px; }
.direct-banner { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; min-height: 44px; padding: 6px 8px 6px 12px; border-radius: 12px; background: var(--light-bg); color: var(--dark); font-size: 13px; }
.direct-banner span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.direct-banner button { flex: 0 0 44px; width: 44px; height: 44px; border: 0; background: transparent; color: var(--muted); font-size: 22px; line-height: 1; cursor: pointer; }
.direct-banner--quote { min-height: 36px; margin: 0 12px 4px; padding: 0 0 0 8px; gap: 6px; border-radius: 0; background: transparent; border-left: 2px solid var(--primary); color: var(--muted); font-size: 12px; line-height: 1.3; }
.direct-banner--quote svg { flex: 0 0 16px; width: 16px; height: 16px; color: var(--primary); }
.direct-quote { display: block; width: 15em; max-width: 100%; margin: 0 0 2px; padding: 0 0 0 6px; border: 0; border-left: 2px solid rgba(var(--dark-rgb), 0.22); border-radius: 0; background: transparent; color: inherit; font: inherit; font-size: 11px; line-height: 1.25; text-align: left; opacity: 0.68; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.direct-bubble__reply { flex: 0 0 44px; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer; }
.direct-bubble__reply:hover { color: var(--primary); background: rgba(var(--primary-rgb), 0.08); }
.direct-bubble__edit { position: relative; flex: 0 0 auto; width: 22px; height: 22px; margin-right: auto; padding: 0; border: 0; background: transparent; color: inherit; opacity: 0.62; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.direct-bubble__edit::before { content: ""; position: absolute; inset: -11px; }
.direct-bubble__edit svg { width: 16px; height: 16px; display: block; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.direct-bubble__edit:hover { opacity: 1; color: var(--primary); }
.direct-log [data-message-id] { scroll-margin-top: 12px; }
.direct-list ul { list-style: none; margin: 0; padding: 0; overflow: auto; }
.presence-face { position: relative; display: flex; flex: 0 0 auto; }
.presence { position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px; border: 2px solid var(--white); border-radius: 50%; background: var(--muted); }
.presence--online { background: #1f9d55; }
.presence--away { background: #e3941a; }
.direct-list a, .direct-list button.direct-list__row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 64px; padding: 8px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; text-decoration: none; cursor: pointer; transition: background-color 0.15s ease; }
.direct-list a:hover, .direct-list button.direct-list__row:hover { background: rgba(var(--dark-rgb), 0.04); }
.direct-list a:hover .trainer-name__line, .direct-list button.direct-list__row:hover .trainer-name__line { color: var(--primary); }
.direct-list a.is-active, .direct-list button.direct-list__row.is-active { background: rgba(var(--primary-rgb), 0.08); }
.direct-list a.is-active:hover, .direct-list button.direct-list__row.is-active:hover { background: rgba(var(--primary-rgb), 0.14); }
.direct-list a.is-active .trainer-name__line, .direct-list button.direct-list__row.is-active .trainer-name__line { color: var(--primary); }
.direct-list__aside { color: var(--muted); font-weight: var(--fw-ui); }
.direct-list__text { display: grid; min-width: 0; flex: 1; }
.direct-list__text strong { color: var(--dark); min-width: 0; overflow: visible; white-space: normal; overflow-wrap: anywhere; }
.direct-list .trainer-name,
.direct-thread__head .trainer-name { flex-direction: row; flex-wrap: wrap; gap: 0.35em; max-width: 100%; }
.direct-list .trainer-name__line,
.direct-thread__head .trainer-name__line { display: inline; width: auto; max-width: 100%; overflow: visible; text-overflow: clip; white-space: normal; }
.direct-list__text em { color: var(--muted); font-style: normal; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.direct-list__meta { display: grid; justify-items: end; gap: 4px; color: var(--muted); font-size: 12px; }
.direct-list__when { display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px; }
.direct-receipt { display: inline-flex; color: var(--muted); }
.direct-receipt svg { width: 18px; height: 14px; display: block; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.direct-receipt.is-read { color: var(--primary); }
.direct-receipt__label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.direct-unread { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 11px; font-weight: var(--fw-title); line-height: 20px; text-align: center; }
.direct-thread { display: flex; flex-direction: column; }
.direct-thread__pane { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; animation: direct-switch 0.24s ease; }
.direct-unblock {
  position: absolute; z-index: 4; left: 50%; top: 50%; transform: translate(-50%, -50%);
  min-height: 44px; padding: 0 18px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--white); color: var(--dark); box-shadow: 0 10px 28px rgba(var(--dark-rgb), 0.16);
  font: inherit; font-size: 14px; font-weight: 400; cursor: pointer; white-space: nowrap;
}
.direct-unblock:hover { color: var(--primary); border-color: var(--primary); }
.direct-thread__head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.direct-thread__identity { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.direct-person__face { display: flex; flex: 0 0 auto; border-radius: 50%; }
.direct-thread__head strong, .direct-thread__head a { color: var(--dark); font-weight: var(--fw-title); text-decoration: none; }
.direct-thread__head span:not(.trainer-name):not(.trainer-name__line):not(.user-avatar):not(.direct-back__label):not(.cabinet-id__open) { display: block; color: var(--muted); font-size: 13px; }
.direct-thread__who a.cabinet-id__line { min-height: 0; gap: 0; }
.direct-thread__who a.direct-thread__trainer,
.direct-thread__who a.direct-thread__trainer strong { color: var(--muted); font-size: 13px; font-weight: var(--fw-ui); }
.direct-thread__who a.cabinet-id__line:hover,
.direct-thread__who a.cabinet-id__line:hover strong,
.direct-thread__who a.cabinet-id__line:hover .trainer-name__line,
.direct-thread__who a.cabinet-id__line:hover .cabinet-id__open { color: var(--primary); }
.direct-thread__head .trainer-name__line { color: var(--dark); font-size: inherit; }
.direct-thread__who { min-width: 0; flex: 1; display: grid; }
.direct-thread__typing { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.2; }
.direct-thread__who a { display: inline-flex; align-items: center; max-width: 100%; }
.direct-thread__who a.direct-thread__trainer { min-height: 28px; }
.direct-switch { display: flex; flex: 0 0 auto; }
.direct-back svg { display: block; }
.direct-thread__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.direct-thread__actions button, .direct-back, .direct-more, .direct-composer__send, .direct-bubble__retry, .direct-report-form button {
  min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
}
.direct-back { position: relative; margin-right: 0; gap: 2px; padding: 0 10px 0 8px; flex: 0 0 auto; }
.direct-log { flex: 1; min-height: 0; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-anchor: none; }
.direct-day { align-self: center; margin: 8px 0; color: var(--muted); font-size: 12px; }
.direct-row { display: flex; flex-direction: row; align-items: flex-end; justify-content: flex-start; gap: 2px; max-width: 100%; overflow-anchor: none; }
.direct-row.is-mine { justify-content: flex-end; }
.direct-row:has(.direct-bubble__reply) .direct-bubble { max-width: min(calc(100% - 48px), 460px); }
.direct-bubble { max-width: min(100%, 460px); min-width: 0; padding: 8px 12px 6px; border-radius: 16px 16px 16px 6px; background: var(--neutral-bg); color: var(--dark); }
.direct-row.is-mine .direct-bubble { border-radius: 16px 16px 6px 16px; }
.direct-bubble.is-user { background: #d7f4f1; }
.direct-bubble.is-trainer { background: #fde8e6; }
.direct-bubble.is-user.is-quoted { background: #c4ebe6; }
.direct-bubble.is-trainer.is-quoted { background: #f6d4d0; }
.direct-bubble.is-quoted:not(.is-user):not(.is-trainer) { background: #efe8e4; }
.direct-bubble.is-user .review-html a { color: #0f766e; }
.direct-bubble.is-trainer .review-html a { color: var(--primary-dark); }
.direct-bubble p, .direct-bubble__text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: inherit; }
.direct-bubble .review-html, .direct-bubble .review-html p, .direct-bubble .review-html a { color: inherit; }
.direct-bubble .review-html p { margin: 0; }
.direct-bubble .review-html p + p { margin-top: 0.7em; }
.direct-bubble .review-html p:empty,
.direct-bubble .review-html p:has(> br:only-child) { min-height: 1.2em; }
.direct-bubble .review-html :is(b, strong) { font-weight: 700; }
.direct-bubble .review-html :is(i, em) { font-style: italic; }
.direct-bubble .review-html u { text-decoration: underline; }
.direct-bubble .review-html s { text-decoration: line-through; }
.direct-bubble .review-html code, .direct-bubble .review-html pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
.direct-bubble .review-html code { padding: 0 4px; border-radius: 4px; background: rgba(0, 0, 0, 0.06); }
.direct-bubble .review-html pre { margin: 4px 0 0; padding: 6px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.06); white-space: pre-wrap; }
.direct-bubble .tg-spoiler { background: rgba(0, 0, 0, 0.72); color: transparent; border-radius: 4px; cursor: pointer; }
.direct-bubble .tg-spoiler.is-open { background: transparent; color: inherit; }
.direct-bubble .review-html ul, .direct-bubble .review-html ol { margin: 0.45em 0; padding-left: 1.2em; }
.direct-bubble .review-html ul { list-style: disc; }
.direct-bubble .review-html ol { list-style: decimal; }
.direct-bubble .review-html li + li { margin-top: 0.25em; }
.direct-bubble__meta { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 2px; }
.direct-bubble__meta time, .direct-bubble__meta .direct-bubble__state { margin: 0; font-size: 12px; opacity: 0.85; }
.direct-bubble__state.is-read { color: var(--dark); font-weight: 600; opacity: 1; }
.direct-bubble.is-deleted { opacity: 0.7; font-style: italic; }
.direct-bubble__retry { min-height: 44px; border: 0; background: transparent; color: var(--muted); padding: 0 4px; }
.direct-thread__actions button.direct-icon { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.direct-thread__actions button.direct-icon svg { width: 20px; height: 20px; display: block; }
.direct-thread__actions button.direct-icon:hover { color: var(--dark); background: rgba(var(--dark-rgb), 0.05); }
.direct-menu { position: relative; }
.direct-thread__actions .direct-menu__btn {
  width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: var(--muted); font-weight: 400; line-height: 1;
  justify-content: center;
}
.direct-thread__actions .direct-menu__btn svg { width: 20px; height: 20px; display: block; }
.direct-thread__actions .direct-menu__btn:hover { color: var(--dark); background: rgba(var(--dark-rgb), 0.05); }
.direct-menu__list {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 6; min-width: 180px; padding: 6px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--white);
  box-shadow: 0 10px 28px rgba(var(--dark-rgb), 0.12);
}
.direct-thread__actions .direct-menu__list button {
  width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-radius: 8px;
  background: transparent; color: var(--dark); font-size: 14px; font-weight: 400; justify-content: flex-start;
}
.direct-thread__actions .direct-menu__list button:hover { background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
.direct-cleared { margin: 8px 16px 12px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.4; }
.direct-composer { position: relative; width: 100%; padding: 8px 10px 10px; border-top: 1px solid var(--line); background: var(--white); }
.direct-composer__row { display: flex; align-items: flex-end; gap: 6px; }
.direct-composer__pill { flex: 1; min-width: 0; display: flex; align-items: flex-end; border-radius: 22px; background: var(--neutral-bg); }
.direct-composer__send { flex: 0 0 44px; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: var(--primary); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s ease, transform 0.2s ease; }
.direct-composer__send:hover:not(:disabled), .direct-composer__send:focus-visible:not(:disabled) { background: var(--primary-dark); transform: translate(2px, -2px); }
.direct-composer__send svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
@media (prefers-reduced-motion: reduce) {
  .direct-composer__send { transition: none; }
}
.direct-composer__send:disabled, .direct-thread__actions button:disabled { opacity: 0.45; cursor: default; }
.direct-composer__count, .direct-composer__hint, .direct-empty { margin: 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.direct-composer__hint { margin: 0; padding: 0 4px 6px; }
.direct-composer__count { padding: 0 8px 4px; text-align: right; }
.direct-composer__count.is-over { color: var(--primary); }
.direct-composer__attach, .direct-emoji { width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.direct-composer__attach svg, .direct-emoji svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.direct-composer__attach:disabled, .direct-emoji:disabled { opacity: 0.45; cursor: default; }
.direct-field-wrap { position: relative; flex: 1; min-width: 0; display: flex; align-items: flex-end; }
.direct-field { flex: 1; min-width: 0; min-height: 44px; max-height: 120px; overflow: auto; padding: 11px 4px 11px 14px; font: inherit; font-size: 16px; font-weight: 400; line-height: 1.35; color: var(--dark); outline: none; white-space: pre-wrap; overflow-wrap: anywhere; }
.direct-field__placeholder { position: absolute; left: 14px; top: 11px; color: var(--muted); font-size: 16px; font-weight: 400; line-height: 1.35; pointer-events: none; user-select: none; }
.direct-field :is(b, strong) { font-weight: 700; }
.direct-field :is(i, em) { font-style: italic; }
.direct-field u { text-decoration: underline; }
.direct-field s { text-decoration: line-through; }
.direct-field code, .direct-field pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
.direct-emoji__panel { position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 40; width: auto; max-width: 360px; margin-left: auto; }
@media (max-width: 767px) {
  .direct.is-thread .direct-emoji__panel { left: var(--layout-gutter); right: var(--layout-gutter); max-width: none; margin-left: 0; }
}
.direct-draft { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 8px 12px 0; }
.direct-draft li { display: flex; align-items: center; gap: 8px; max-width: 100%; min-height: 44px; padding: 4px 8px 4px 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--light-bg); }
.direct-draft li.is-image { position: relative; width: 96px; height: 96px; padding: 0; overflow: hidden; }
.direct-draft img { width: 36px; height: 36px; object-fit: cover; border-radius: 8px; }
.direct-draft li.is-image img { width: 100%; height: 100%; border-radius: 0; }
.direct-draft span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dark); font-size: 13px; }
.direct-draft button { min-height: 44px; min-width: 44px; border: 0; background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
.direct-draft li.is-image button { position: absolute; top: 0; right: 0; width: 44px; height: 44px; padding: 0; border-radius: 0 12px 0 12px; background: rgba(20, 16, 16, 0.55); color: #fff; font-size: 22px; line-height: 1; }
.direct-files { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.direct-preview { display: block; width: 72px; height: 72px; padding: 0; border: 0; border-radius: 10px; overflow: hidden; background: rgba(20, 16, 16, 0.06); cursor: pointer; }
.direct-preview img { display: block; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: cover; border-radius: 0; }
.direct-file { min-height: 44px; display: inline-flex; align-items: center; color: inherit; overflow-wrap: anywhere; }
.direct-lightbox { position: fixed; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center; padding: max(68px, calc(env(safe-area-inset-top) + 56px)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); background: rgba(20, 16, 16, 0.88); }
.direct-lightbox__bar { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); display: flex; align-items: center; gap: 8px; }
.direct-lightbox__bar button, .direct-lightbox__close { width: 44px; height: 44px; min-width: 44px; padding: 0; border: 0; border-radius: 999px; background: var(--white); color: var(--dark); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.direct-lightbox__bar svg { width: 20px; height: 20px; display: block; }
.direct-lightbox img { display: block; max-width: min(92vw, 960px); max-height: calc(100dvh - 140px); object-fit: contain; transition: transform 0.2s ease; }
.direct-lightbox img.is-sideways { max-width: calc(100dvh - 140px); max-height: min(92vw, 960px); }
.direct-empty { padding: 16px; }
.direct-skeletons { display: grid; gap: 10px; padding: 16px; }
.direct-skeletons span { display: block; height: 52px; border-radius: 12px; background: linear-gradient(90deg, var(--neutral-bg), var(--line), var(--neutral-bg)); background-size: 200% 100%; animation: direct-pulse 1.2s ease infinite; }
@keyframes direct-pulse { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.direct-report-form { display: grid; gap: 12px; }
.direct-report-form label { display: grid; gap: 6px; color: var(--dark); font-size: 14px; font-weight: var(--fw-ui); }
.direct-report-form select, .direct-report-form textarea { width: 100%; border: 1px solid var(--line); border-radius: 12px; font: inherit; font-size: 16px; background: var(--white); color: var(--dark); }
.direct-report-form select { min-height: 44px; padding: 0 12px; }
.direct-report-form textarea { min-height: 120px; padding: 12px 14px; resize: vertical; }
.direct-report-form p { margin: 0; color: var(--muted); font-size: 13px; text-align: right; }
.direct-report-form p.direct-report-form__note { color: var(--dark); font-size: 14px; font-weight: var(--fw-body); line-height: 1.45; text-align: left; }
.direct-report-form__actions { display: flex; gap: 8px; }
.direct-report-form__actions button { flex: 1; box-sizing: border-box; min-height: 44px; justify-content: center; }
.direct-report-form p.is-over { color: var(--primary); }
.direct-report-form button.direct-report-form__send { justify-content: center; border-color: transparent; background: var(--primary); color: #fff; }
.direct-report-form button.direct-report-form__send:disabled { opacity: 0.55; cursor: default; }
.direct-more { margin: 8px auto; }
@media (min-width: 768px) {
  .direct:not(.is-mobile) { grid-template-rows: minmax(560px, 70vh); }
  .direct:not(.is-mobile) .direct-list { border-bottom: 0; }
  .direct:not(.is-mobile).is-open { grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); }
  .direct:not(.is-mobile).is-open .direct-list { border-right: 1px solid var(--line); }
  .direct:not(.is-mobile):not(.is-open) .direct-thread { display: none; }
}
@media (max-width: 767px) {
  .direct { display: flex; flex-direction: column; min-height: 60vh; }
  .direct:not(.is-thread) .direct-thread { display: none; }
  .direct:not(.is-thread) .direct-list { flex: 1; min-height: 50vh; border-bottom: 0; }
  .direct.is-thread {
    position: fixed; z-index: 280; left: 0; right: 0; top: var(--direct-top, var(--header-clearance)); bottom: var(--keyboard-inset, 0px);
    display: flex; min-height: 0; border: 0; border-radius: 0; background: var(--white);
    padding-bottom: var(--keyboard-pad, env(safe-area-inset-bottom));
    transition: bottom 0.2s ease, padding-bottom 0.2s ease;
    animation: direct-sheet 0.28s cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .direct.is-thread .direct-list { display: none; }
  .direct.is-thread .direct-thread { flex: 1; min-height: 0; height: 100%; }
  .direct.is-thread .direct-thread__pane { animation: none; }
  .direct.is-thread .direct-thread__head { flex-wrap: nowrap; align-items: center; padding-inline: var(--layout-gutter); }
  .direct.is-thread .direct-thread__who { overflow: hidden; }
  .direct.is-thread .direct-thread__who > * { min-width: 0; max-width: 100%; }
  .direct.is-thread .direct-thread__who a.cabinet-id__line { display: flex; min-width: 0; max-width: 100%; }
  .direct.is-thread .direct-thread__who a.cabinet-id__line > strong { flex: 1 1 auto; width: auto; min-width: 0; overflow: visible; white-space: normal; overflow-wrap: anywhere; }
  .direct.is-thread .direct-thread__who > strong { display: block; min-width: 0; max-width: 100%; overflow: visible; white-space: normal; overflow-wrap: anywhere; }
  .direct.is-thread .direct-thread__who .trainer-name { width: 100%; min-width: 0; max-width: 100%; overflow: visible; }
  .direct.is-thread .direct-thread__who .trainer-name__line { min-width: 0; overflow: visible; text-overflow: clip; white-space: normal; }
  .direct.is-thread .direct-thread__who a.direct-thread__trainer { min-width: 0; max-width: 100%; }
  .direct.is-thread .direct-thread__who a.direct-thread__trainer > strong { display: block; min-width: 0; overflow: visible; white-space: normal; overflow-wrap: anywhere; }
  .direct.is-thread .direct-thread__actions { flex: 0 0 auto; margin-left: 0; flex-wrap: nowrap; }
  .direct.is-thread .direct-composer,
  .direct.is-thread .direct-log { background: var(--white); }
  .direct.is-thread .direct-log,
  .direct.is-thread .direct-composer,
  .direct.is-thread .direct-draft,
  .direct.is-thread .direct-composer__hint { padding-inline: var(--layout-gutter); }
  .direct-switch { display: none; }
  body:has(.direct.is-thread) { overflow: hidden; }
}
@media (min-width: 768px) {
  .direct-field, .direct-field__placeholder { font-size: 14px; }
}
@keyframes direct-switch { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes direct-sheet { from { transform: translateX(100%); } to { transform: none; } }
@media (max-width: 480px) {
  .direct-back { width: 44px; padding: 0; justify-content: center; }
  .direct-back__label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .direct-thread__pane, .direct.is-thread { animation: none; transition: none; }
}
`;
