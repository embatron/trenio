export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
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
