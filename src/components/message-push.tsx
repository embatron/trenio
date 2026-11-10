import { useEffect } from "react";
import { useRouteContext } from "@tanstack/react-router";

import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getPushPublicKeyFn, savePushSubscriptionFn } from "@/lib/messages/push-functions";
import {
  canUsePush,
  disableDevicePush,
  enableDevicePush,
  pushAlreadyAsked,
  rememberPushAsked,
} from "@/lib/messages/push-client";

/**
 * Browser notices stay on until the person turns them off in cabinet settings.
 * The browser still needs one tap before it shows its own permission dialog.
 */
export function MessagePush() {
  const { user } = useRouteContext({ from: "__root__" });
  const loadKey = useAuthServerFn(getPushPublicKeyFn);
  const save = useAuthServerFn(savePushSubscriptionFn);
  const userId = user?.id;
  const enabled = user?.pushMessages;

  useEffect(() => {
    if (!userId || !canUsePush()) return;
    let cancelled = false;
    const askRef: { current: ((event: Event) => void) | null } = { current: null };
    if (!enabled) {
      void disableDevicePush().catch(() => undefined);
      return;
    }

    void loadKey().then((result) => {
      if (cancelled || !result.publicKey) return;
      if (Notification.permission === "granted") {
        void enableDevicePush(result.publicKey, save);
        return;
      }
      if (Notification.permission !== "default" || pushAlreadyAsked()) return;
      const publicKey = result.publicKey;
      askRef.current = (event: Event) => {
        if (event.target instanceof Element && event.target.closest("#notices")) return;
        if (askRef.current) window.removeEventListener("pointerdown", askRef.current, true);
        askRef.current = null;
        rememberPushAsked();
        void Notification.requestPermission().then((permission) => {
          if (cancelled || permission !== "granted") return;
          void enableDevicePush(publicKey, save);
        });
      };
      window.addEventListener("pointerdown", askRef.current, true);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (askRef.current) window.removeEventListener("pointerdown", askRef.current, true);
    };
  }, [userId, enabled, loadKey, save]);

  return null;
}
