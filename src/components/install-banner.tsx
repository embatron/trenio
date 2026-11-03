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
const INSTALLED_KEY = "trenio-app-installed";
const INSTALLED_MODES = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];

function rememberInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* private mode keeps the decision for this launch only */
  }
}

function storedInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function launchedInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  if (document.referrer.startsWith("android-app://")) return true;
  return INSTALLED_MODES.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}

export function InstallBanner() {
  const [place, setPlace] = useState<"telegram" | "browser" | null>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [steps, setSteps] = useState<"ios" | "menu" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const phone = window.matchMedia(PHONE);
    const hideInstalled = () => {
      rememberInstalled();
      setPlace(null);
    };
    const showBrowser = () => {
      if (cancelled || getTelegramWebApp()?.initData?.trim()) return;
      if (launchedInstalled()) {
        hideInstalled();
        return;
      }
      if (storedInstalled()) return;
      setPlace(phone.matches ? "browser" : null);
    };
    if (launchedInstalled()) hideInstalled();
    const timer = window.setTimeout(showBrowser, 800);
    const onPrompt = (event: Event) => {
      if (storedInstalled() || launchedInstalled()) return;
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => hideInstalled();
    const onMode = () => {
      if (launchedInstalled()) hideInstalled();
    };
    const modes = INSTALLED_MODES.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    phone.addEventListener("change", showBrowser);
    for (const mode of modes) mode.addEventListener("change", onMode);
    const related = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    void related.getInstalledRelatedApps?.().then((apps) => {
      if (!cancelled && apps.length > 0) hideInstalled();
    }).catch(() => undefined);

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
          if (status === "added") rememberInstalled();
          setPlace(null);
          return;
        }
        if (storedInstalled()) return;
        if (status) setPlace("telegram");
      };
      webApp.checkHomeScreenStatus(apply);
      const onAdded = () => {
        if (!cancelled) hideInstalled();
      };
      webApp.onEvent?.("homeScreenAdded", onAdded);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      phone.removeEventListener("change", showBrowser);
      for (const mode of modes) mode.removeEventListener("change", onMode);
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
                    if (choice.outcome === "accepted") {
                      rememberInstalled();
                      setPlace(null);
                    }
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
