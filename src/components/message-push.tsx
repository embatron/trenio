import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";

import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getPushPublicKeyFn, savePushSubscriptionFn } from "@/lib/messages/push-functions";
import { getTelegramWebApp } from "@/lib/telegram-webapp";

const DISMISS_KEY = "trenio-push-dismissed";
const PHONE = "(max-width: 767px)";

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* private mode hides the offer for this launch only */
  }
}

function installedApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone)
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: minimal-ui)").matches;
}

function mobileApp(): boolean {
  if (getTelegramWebApp()?.initData?.trim()) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  return installedApp() || window.matchMedia(PHONE).matches;
}

function keyBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function subscribe(
  publicKey: string,
  save: (input: { data: { endpoint: string; p256dh: string; auth: string } }) => Promise<unknown>,
) {
  const registration = await navigator.serviceWorker.register("/sw.js");
  const ready = await navigator.serviceWorker.ready;
  const current = await ready.pushManager.getSubscription();
  const subscription = current ?? await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
  await save({ data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } });
  void registration;
}

/** Asks a phone, once, to allow system notices for new messages. Telegram uses the bot instead. */
export function MessagePush() {
  const { user } = useRouteContext({ from: "__root__" });
  const loadKey = useAuthServerFn(getPushPublicKeyFn);
  const save = useAuthServerFn(savePushSubscriptionFn);
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    if (!user || !mobileApp()) return;
    let cancelled = false;
    void loadKey().then(async (result) => {
      if (cancelled || !result.publicKey) return;
      if (Notification.permission === "granted") {
        await subscribe(result.publicKey, save);
        return;
      }
      if (Notification.permission === "default" && !dismissed()) setOffer(true);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, loadKey, save]);

  if (!user || !offer) return null;

  return (
    <div className="install-banner message-push">
      <style>{`.message-push button.is-quiet { background: transparent; color: var(--text); }`}</style>
      <p>Включите уведомления, чтобы не пропустить сообщение.</p>
      <button
        type="button"
        onClick={() => {
          void Notification.requestPermission().then(async (permission) => {
            setOffer(false);
            if (permission !== "granted") {
              rememberDismissed();
              return;
            }
            const result = await loadKey();
            if (!result.publicKey) return;
            await subscribe(result.publicKey, save);
          }).catch(() => setOffer(false));
        }}
      >
        Включить
      </button>
      <button
        type="button"
        className="is-quiet"
        onClick={() => {
          rememberDismissed();
          setOffer(false);
        }}
      >
        Не сейчас
      </button>
    </div>
  );
}
