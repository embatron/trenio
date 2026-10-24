import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { unreadCountFn } from "@/lib/messages/functions";
import { MESSAGE_SCAN_MS } from "@/lib/messages/polling";
import { EMPTY_MESSAGING, type MessagingSummary } from "@/lib/messages/schemas";

const MessagesLiveContext = createContext<MessagingSummary>(EMPTY_MESSAGING);

export function useMessaging() {
  return useContext(MessagesLiveContext);
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
  const [summary, setSummary] = useState(initial);
  const unread = useServerFn(unreadCountFn);
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  useEffect(() => {
    setSummary(userId ? initial : EMPTY_MESSAGING);
  }, [initial, userId]);

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    let timer = 0;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await unreadRef.current({ data: {} });
        if (!stop) setSummary(next);
      } catch {
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
