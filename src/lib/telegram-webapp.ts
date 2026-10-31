export type TelegramWebAppBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
};

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  BackButton?: TelegramWebAppBackButton;
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
