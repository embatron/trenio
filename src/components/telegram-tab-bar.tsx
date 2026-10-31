import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { TELEGRAM_NAV, activeTelegramNavPath } from "@/lib/telegram/nav";
import { getTelegramWebApp, prepareTelegramWebApp } from "@/lib/telegram-webapp";

const SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

function useTelegramShell(): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    const mark = () => {
      prepareTelegramWebApp();
      setInside(Boolean(getTelegramWebApp()?.initData?.trim()));
    };
    const existing = document.querySelector<HTMLScriptElement>("script[src*='telegram-web-app.js']");
    if (existing) {
      if (window.Telegram?.WebApp) mark();
      else existing.addEventListener("load", mark, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = mark;
    document.head.appendChild(script);
  }, []);

  return inside;
}

export function TelegramAppChrome() {
  const inside = useTelegramShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!inside) return;
    const webApp = getTelegramWebApp();
    const back = webApp?.BackButton;
    if (!back) return;
    const atHome = (pathname.replace(/\/+$/, "") || "/") === "/";
    if (atHome) {
      back.hide();
      return;
    }
    const onBack = () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.assign("/");
    };
    back.onClick(onBack);
    back.show();
    return () => {
      back.offClick(onBack);
      back.hide();
    };
  }, [inside, pathname]);

  if (!inside) return null;
  const current = activeTelegramNavPath(pathname);

  return (
    <>
      <style>{TAB_CSS}</style>
      <nav className="tg-tabbar" aria-label="Разделы">
        {TELEGRAM_NAV.map((item) => {
          const on = current === item.path;
          const className = on ? "is-on" : undefined;
          return (
            <a key={item.path} href={item.path} className={className} aria-current={on ? "page" : undefined}>
              {item.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}

const TAB_CSS = `
html.telegram-webapp body { padding-bottom: calc(92px + env(safe-area-inset-bottom)); }
.tg-tabbar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  background: var(--white);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.tg-tabbar a {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 6px 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: var(--fw-ui);
  line-height: 1.15;
  text-align: center;
  text-decoration: none;
}
.tg-tabbar a.is-on { color: var(--primary); }
`;
