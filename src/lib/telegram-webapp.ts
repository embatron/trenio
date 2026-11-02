export type TelegramWebAppBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
};

export type TelegramContactResponse =
  | { status: "sent"; response?: string }
  | { status: "cancelled"; response?: string };

export type TelegramHomeScreenStatus = "unsupported" | "unknown" | "added" | "missed";

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  BackButton?: TelegramWebAppBackButton;
  requestContact?: (callback: (shared: boolean, response?: TelegramContactResponse) => void) => void;
  openTelegramLink?: (url: string) => void;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (callback: (status: TelegramHomeScreenStatus | { status?: TelegramHomeScreenStatus }) => void) => void;
  onEvent?: (event: string, callback: (payload?: { status?: TelegramHomeScreenStatus }) => void) => void;
  offEvent?: (event: string, callback: (payload?: { status?: TelegramHomeScreenStatus }) => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    __trenioTelegramAuth?: (user: import("@/lib/auth/telegram-widget").TelegramWidgetUser) => void;
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramWebAppInitData(): string {
  return getTelegramWebApp()?.initData?.trim() ?? "";
}

/** Signed contact query, or null when Telegram did not share a number. The raw phone is not returned. */
export function requestTelegramContact(timeoutMs = 60_000): Promise<string | null> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (!webApp?.requestContact) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    try {
      webApp.requestContact((shared, response) => {
        if (shared && response?.status === "sent" && response.response) finish(response.response);
        else finish(null);
      });
    } catch {
      finish(null);
    }
  });
}

const TELEGRAM_SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const scriptWaiters: Array<() => void> = [];
let scriptRequested = false;

export function ensureTelegramWebApp(onReady: () => void): void {
  if (typeof window === "undefined") return;
  if (window.Telegram?.WebApp) {
    onReady();
    return;
  }
  scriptWaiters.push(onReady);
  if (scriptRequested) return;
  scriptRequested = true;
  const flush = () => {
    const waiters = scriptWaiters.splice(0);
    waiters.forEach((waiter) => waiter());
  };
  const existing = document.querySelector<HTMLScriptElement>("script[src*='telegram-web-app.js']");
  if (existing) {
    existing.addEventListener("load", flush, { once: true });
    existing.addEventListener("error", flush, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = TELEGRAM_SCRIPT;
  script.async = true;
  script.onload = flush;
  script.onerror = flush;
  document.head.appendChild(script);
}

export function homeScreenStatus(value: unknown): TelegramHomeScreenStatus | null {
  const status = typeof value === "string" ? value : (value as { status?: string } | null)?.status;
  if (status === "unsupported" || status === "unknown" || status === "added" || status === "missed") return status;
  return null;
}

export function openTelegramAccount(url: string): void {
  const webApp = getTelegramWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  window.location.assign(url);
}

export function prepareTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  webApp.setHeaderColor?.("#ffffff");
  webApp.setBackgroundColor?.("#fff5f5");
  webApp.disableVerticalSwipes?.();
  document.documentElement.classList.add("telegram-webapp");
}
