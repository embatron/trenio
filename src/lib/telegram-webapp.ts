export type TelegramWebAppBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
};

export type TelegramContactResponse =
  | { status: "sent"; response?: string }
  | { status: "cancelled"; response?: string };

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  BackButton?: TelegramWebAppBackButton;
  requestContact?: (callback: (shared: boolean, response?: TelegramContactResponse) => void) => void;
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
