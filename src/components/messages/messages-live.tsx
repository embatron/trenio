import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { isAuthorizationRequired } from "@/lib/auth/errors";
import { hasAnyRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { redirectToLogin } from "@/lib/auth/return-path";
import { unreadCountFn } from "@/lib/messages/functions";
import { bindTypingSender, noteCabinet, noteRemoteTyping } from "@/lib/messages/live-client";
import { nextMessageAnnounce } from "@/lib/messages/notice";
import { MESSAGE_SOCKET_FALLBACK_MS } from "@/lib/messages/polling";
import { EMPTY_MESSAGING, type MessageNotice, type MessagingSummary } from "@/lib/messages/schemas";

const MessagesLiveContext = createContext<MessagingSummary>(EMPTY_MESSAGING);
const MessagesReadContext = createContext<(bucket: "own" | "inbox", drop: number) => void>(() => {});
const MessagesRefreshContext = createContext<() => void>(() => {});

export function useMessaging() {
  return useContext(MessagesLiveContext);
}

/** Drop the header and menu count as soon as this screen has seen those messages. */
export function useNoteMessagesRead() {
  return useContext(MessagesReadContext);
}

/** Read the counters again after a reply or a read cursor move. */
export function useRefreshMessages() {
  return useContext(MessagesRefreshContext);
}

function openIncoming(
  router: ReturnType<typeof useRouter>,
  roles: UserRole[],
  conversationId: string,
) {
  if (hasAnyRole(roles, ["admin", "superadmin"])) {
    void router.navigate({ to: "/admin/messages", search: { conversation: conversationId } });
    return;
  }
  if (hasAnyRole(roles, ["trainer", "club"])) {
    void router.navigate({ to: "/me/messages/$conversationId", params: { conversationId } });
    return;
  }
  void router.navigate({ to: "/account/messages/$conversationId", params: { conversationId } });
}

function announceIncoming(
  router: ReturnType<typeof useRouter>,
  roles: UserRole[],
  notice: MessageNotice,
) {
  toast("Вам написали", {
    id: `message-${notice.conversationId}`,
    description: notice.name,
    duration: 8000,
    action: {
      label: "Открыть",
      onClick: () => openIncoming(router, roles, notice.conversationId),
    },
  });
}

function applyFrame(queryClient: ReturnType<typeof useQueryClient>, raw: string, refresh: () => void) {
  let frame: { type?: string; conversationId?: string; on?: boolean };
  try {
    frame = JSON.parse(raw) as typeof frame;
  } catch {
    return;
  }
  if (frame.type === "cabinet") {
    noteCabinet();
    return;
  }
  if (frame.type === "typing" && frame.conversationId) {
    noteRemoteTyping(frame.conversationId, frame.on === true);
    return;
  }
  if (frame.type === "thread" && frame.conversationId) {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["messages", frame.conversationId] });
    return;
  }
  if (frame.type === "unread") refresh();
}

/** Keeps the open dialog current over one websocket, and the header count with it. */
export function MessagesLive({
  userId,
  initial,
  children,
}: {
  userId: string | null;
  initial: MessagingSummary;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useRouteContext({ from: "__root__" });
  const [summary, setSummary] = useState(initial);
  const noteRead = useCallback((bucket: "own" | "inbox", drop: number) => {
    if (drop <= 0) return;
    setSummary((current) => ({
      ...current,
      total: Math.max(0, current.total - drop),
      own: bucket === "own" ? Math.max(0, current.own - drop) : current.own,
      inbox: bucket === "inbox" ? Math.max(0, current.inbox - drop) : current.inbox,
    }));
  }, []);
  const unread = useServerFn(unreadCountFn);
  const unreadRef = useRef(unread);
  unreadRef.current = unread;
  const queryRef = useRef(queryClient);
  queryRef.current = queryClient;
  const routerRef = useRef(router);
  routerRef.current = router;
  const rolesRef = useRef(user?.roles ?? []);
  rolesRef.current = user?.roles ?? [];
  const pushRef = useRef(user?.pushMessages !== false);
  pushRef.current = user?.pushMessages !== false;
  const seenRef = useRef<number | null>(null);
  const seenUserRef = useRef<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const refreshMessages = useCallback(() => {
    refreshRef.current();
  }, []);

  useEffect(() => {
    setSummary(userId ? initial : EMPTY_MESSAGING);
    if (!userId) {
      seenRef.current = null;
      seenUserRef.current = null;
      return;
    }
    const id = initial.notice?.messageId ?? 0;
    if (seenUserRef.current !== userId) {
      seenUserRef.current = userId;
      seenRef.current = id;
      return;
    }
    if (seenRef.current == null || id > seenRef.current) seenRef.current = id;
  }, [initial, userId]);

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    let retry = 0;
    let retryTimer = 0;
    let fallback = 0;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await unreadRef.current({ data: {} });
        if (stop) return;
        setSummary(next);
        const decision = nextMessageAnnounce(
          seenRef.current,
          next.notice,
          window.location.pathname,
        );
        if (decision.announce && !pushRef.current) {
          seenRef.current = decision.seen;
          return;
        }
        if (decision.announce && !document.hasFocus()) return;
        seenRef.current = decision.seen;
        if (decision.announce && next.notice) {
          announceIncoming(routerRef.current, rolesRef.current, next.notice);
        }
      } catch (error) {
        if (isAuthorizationRequired(error)) {
          stop = true;
          socketRef.current?.close();
          redirectToLogin();
        }
      }
    };
    refreshRef.current = () => {
      void refresh();
    };
    const refreshOpen = () => {
      void refresh();
      void queryRef.current.invalidateQueries({ queryKey: ["conversations"] });
      void queryRef.current.invalidateQueries({ queryKey: ["messages"] });
    };
    const unbind = bindTypingSender((conversationId, on) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "typing", conversationId, on }));
    });
    const sendPresence = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "presence", visible: document.visibilityState === "visible" }));
    };
    const connect = () => {
      if (stop) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${proto}//${window.location.host}/messages/live`);
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
        window.clearInterval(fallback);
        fallback = 0;
        sendPresence();
        refreshOpen();
      };
      socket.onmessage = (event) => {
        if (typeof event.data === "string") applyFrame(queryRef.current, event.data, () => void refresh());
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stop) return;
        if (!fallback) {
          fallback = window.setInterval(() => {
            if (document.visibilityState === "hidden") return;
            refreshOpen();
          }, MESSAGE_SOCKET_FALLBACK_MS);
        }
        const wait = Math.min(1000 * 2 ** retry, 15_000);
        retry = Math.min(retry + 1, 4);
        retryTimer = window.setTimeout(connect, wait);
      };
    };
    const onVisible = () => {
      sendPresence();
      if (document.visibilityState === "visible") refreshOpen();
    };
    document.addEventListener("visibilitychange", onVisible);
    const presenceTimer = window.setInterval(sendPresence, 20_000);
    connect();
    return () => {
      stop = true;
      unbind();
      window.clearTimeout(retryTimer);
      window.clearInterval(fallback);
      window.clearInterval(presenceTimer);
      document.removeEventListener("visibilitychange", onVisible);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [userId]);

  return (
    <MessagesRefreshContext.Provider value={refreshMessages}>
      <MessagesReadContext.Provider value={noteRead}>
        <MessagesLiveContext.Provider value={summary}>{children}</MessagesLiveContext.Provider>
      </MessagesReadContext.Provider>
    </MessagesRefreshContext.Provider>
  );
}
