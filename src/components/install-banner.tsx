import { useEffect, useState } from "react";

import {
  ensureTelegramWebApp,
  getTelegramWebApp,
  homeScreenStatus,
  prepareTelegramWebApp,
} from "@/lib/telegram-webapp";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const PHONE = "(max-width: 767px)";

function installedSite(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

export function InstallBanner() {
  const [place, setPlace] = useState<"telegram" | "browser" | null>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [steps, setSteps] = useState<"ios" | "menu" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const phone = window.matchMedia(PHONE);
    const showBrowser = () => {
      if (cancelled || getTelegramWebApp()?.initData?.trim() || installedSite()) return;
      setPlace(phone.matches ? "browser" : null);
    };
    const timer = window.setTimeout(showBrowser, 800);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    phone.addEventListener("change", showBrowser);

    ensureTelegramWebApp(() => {
      if (cancelled) return;
      window.clearTimeout(timer);
      prepareTelegramWebApp();
      const webApp = getTelegramWebApp();
      if (!webApp?.initData?.trim()) {
        showBrowser();
        return;
      }
      if (!webApp.checkHomeScreenStatus || !webApp.addToHomeScreen) {
        setPlace(null);
        return;
      }
      const apply = (value: unknown) => {
        if (cancelled) return;
        const status = homeScreenStatus(value);
        if (status === "added" || status === "unsupported") {
          setPlace(null);
          return;
        }
        if (status) setPlace("telegram");
      };
      webApp.checkHomeScreenStatus(apply);
      const onAdded = () => {
        if (!cancelled) setPlace(null);
      };
      webApp.onEvent?.("homeScreenAdded", onAdded);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      phone.removeEventListener("change", showBrowser);
    };
  }, []);

  if (!place) return null;

  const phrase =
    steps === "ios"
      ? "В меню «Поделиться» выберите «На экран Домой»."
      : steps === "menu"
        ? "В меню браузера выберите «Добавить на главный экран»."
        : "Поставьте приложение на экран, чтобы оно всегда было под рукой.";

  return (
    <>
      <style>{BANNER_CSS}</style>
      <div className="install-banner">
        <p>{phrase}</p>
        {steps ? null : (
          <button
            type="button"
            onClick={() => {
              if (place === "telegram") {
                getTelegramWebApp()?.addToHomeScreen?.();
                return;
              }
              if (promptEvent) {
                void promptEvent.prompt().then(() => {
                  void promptEvent.userChoice.then((choice) => {
                    if (choice.outcome === "accepted") setPlace(null);
                  });
                });
                return;
              }
              setSteps(/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "menu");
            }}
          >
            Установить
          </button>
        )}
      </div>
    </>
  );
}

const BANNER_CSS = `
.install-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: var(--layout-max);
  margin-inline: auto;
  padding: 8px var(--layout-gutter);
  background: #fff5f5;
  border-bottom: 1px solid var(--line);
}
.install-banner p {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.35;
}
.install-banner button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-family: Inter, Manrope, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
`;
