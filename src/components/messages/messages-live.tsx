import { useRouter, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { isAuthorizationRequired } from "@/lib/auth/errors";
import { hasAnyRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { redirectToLogin } from "@/lib/auth/return-path";
import { unreadCountFn } from "@/lib/messages/functions";
import { nextMessageAnnounce } from "@/lib/messages/notice";
import { MESSAGE_SCAN_MS } from "@/lib/messages/polling";
import { EMPTY_MESSAGING, type MessageNotice, type MessagingSummary } from "@/lib/messages/schemas";

const MessagesLiveContext = createContext<MessagingSummary>(EMPTY_MESSAGING);

export function useMessaging() {
  return useContext(MessagesLiveContext);
}

function openIncoming(
  router: ReturnType<typeof useRouter>,
  roles: UserRole[],
  conversationId: string,
) {
  if (hasAnyRole(roles, ["admin", "superadmin"])) {
    void router.navigate({ to: "/admin/messages" });
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

/** Keeps the header and sidebar counts current while the tab is open. */
export function MessagesLive({
  userId,
  initial,
  children,
}: {
  userId: string | null;
  initial: MessagingSummary;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user } = useRouteContext({ from: "__root__" });
  const [summary, setSummary] = useState(initial);
  const unread = useServerFn(unreadCountFn);
  const unreadRef = useRef(unread);
  unreadRef.current = unread;
  const routerRef = useRef(router);
  routerRef.current = router;
  const rolesRef = useRef(user?.roles ?? []);
  rolesRef.current = user?.roles ?? [];
  const pushRef = useRef(user?.pushMessages !== false);
  pushRef.current = user?.pushMessages !== false;
  const seenRef = useRef<number | null>(null);
  const seenUserRef = useRef<string | null>(null);

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
    let timer = 0;
    const tick = async () => {
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
          redirectToLogin();
          return;
        }
        /* keep the last count; the next pass retries */
      }
    };
    const loop = () => {
      timer = window.setTimeout(() => {
        void tick().finally(() => {
          if (!stop) loop();
        });
      }, MESSAGE_SCAN_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return <MessagesLiveContext.Provider value={summary}>{children}</MessagesLiveContext.Provider>;
}
