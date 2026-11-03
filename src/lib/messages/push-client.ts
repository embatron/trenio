import { getTelegramWebApp } from "@/lib/telegram-webapp";

const ASKED_KEY = "trenio-push-asked";
const PHONE = "(max-width: 767px)";
const INSTALLED_MODES = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];

type PushSave = (input: { data: { endpoint: string; p256dh: string; auth: string } }) => Promise<unknown>;

/** This browser can hold a system subscription. Telegram Mini App cannot. */
export function canUsePush(): boolean {
  if (typeof window === "undefined") return false;
  if (getTelegramWebApp()?.initData?.trim()) return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** A phone or an installed app, where a new message should ask for a system notice. */
export function phonePush(): boolean {
  if (!canUsePush()) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const installed = Boolean(nav.standalone)
    || INSTALLED_MODES.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
  return installed || window.matchMedia(PHONE).matches;
}

export function pushAlreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberPushAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* private mode asks again on the next launch */
  }
}

export function clearPushAsked() {
  try {
    localStorage.removeItem(ASKED_KEY);
  } catch {
    /* ignore */
  }
}

function keyBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Register the push worker and store this device. Safe to call again. */
export async function enableDevicePush(publicKey: string, save: PushSave) {
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

function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Drop the subscription in this browser. The server row is removed with the setting. */
export async function disableDevicePush() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await within(navigator.serviceWorker.getRegistrations(), 1500, []);
  await Promise.all(registrations.map(async (registration) => {
    const current = await within(registration.pushManager.getSubscription(), 1500, null);
    if (current) await current.unsubscribe();
  }));
}
