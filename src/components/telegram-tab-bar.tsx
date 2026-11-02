import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { TELEGRAM_NAV, activeTelegramNavPath } from "@/lib/telegram/nav";
import { getTelegramWebApp, prepareTelegramWebApp } from "@/lib/telegram-webapp";

const NAV_ICONS: Record<string, { paths: readonly string[]; pin?: boolean; plus?: boolean }> = {
  trainers: {
    paths: [
      "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M3 20a6 6 0 0 1 12 0",
      "M15 20a5 5 0 0 1 6 0",
    ],
  },
  categories: { paths: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"] },
  map: { paths: ["M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z"], pin: true },
  messages: { paths: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M4 6l8 6 8-6"] },
  account: { paths: ["M4 10.5 12 4l8 6.5V20H4z", "M10 20v-6h4v6"] },
  me: { paths: ["M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"] },
  join: { plus: true, paths: [] },
  contacts: { paths: ["M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M9 8h6", "M9 12h6", "M9 16h4"] },
};

function ScrollHint({ direction, on }: { direction: "start" | "end"; on: boolean }) {
  return (
    <span className={`tg-tabbar__hint tg-tabbar__hint--${direction}${on ? " is-on" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={direction === "start" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"} />
      </svg>
    </span>
  );
}

function NavIcon({ command }: { command: string }) {
  const icon = NAV_ICONS[command];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icon.plus ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </>
      ) : (
        icon.paths.map((d) => <path key={d} d={d} />)
      )}
      {icon.pin ? <circle cx="12" cy="9" r="2.4" /> : null}
    </svg>
  );
}

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
  const currentRef = useRef<HTMLAnchorElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ start: false, end: false });

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

  const current = activeTelegramNavPath(pathname);

  useEffect(() => {
    const item = currentRef.current;
    const track = trackRef.current;
    if (!item || !track) return;
    const left = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left) });
  }, [current, inside]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const start = track.scrollLeft > 6;
      const end = max - track.scrollLeft > 6;
      setMore((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    const fonts = document.fonts?.ready.then(update);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
      void fonts;
    };
  }, [current, inside]);

  if (!inside) return null;

  return (
    <>
      <style>{TAB_CSS}</style>
      <nav className="tg-tabbar" aria-label="Разделы">
        <ScrollHint direction="start" on={more.start} />
        <div className="layout-rail">
          <div className="layout-rail__track" ref={trackRef}>
            {TELEGRAM_NAV.map((item) => {
              const on = current === item.path;
              return (
                <a
                  key={item.path}
                  ref={on ? currentRef : undefined}
                  href={item.path}
                  className={on ? "is-on" : undefined}
                  aria-current={on ? "page" : undefined}
                >
                  <NavIcon command={item.command} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
        <ScrollHint direction="end" on={more.end} />
      </nav>
    </>
  );
}

const TAB_CSS = `
html.telegram-webapp body { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
.tg-tabbar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  background: var(--white);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.tg-tabbar .layout-rail {
  width: 100%;
  max-width: var(--layout-max);
  margin-inline: auto;
  padding-inline: var(--layout-gutter, 20px);
  padding-block: 0;
}
.tg-tabbar .layout-rail__track {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 8px;
  margin: 0;
  padding-block: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}
.tg-tabbar .layout-rail__track::-webkit-scrollbar { display: none; }
.tg-tabbar__hint {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: env(safe-area-inset-bottom);
  width: 28px;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.18s ease;
}
.tg-tabbar__hint.is-on { opacity: 1; }
.tg-tabbar__hint--start {
  left: 0;
  justify-content: flex-start;
  padding-left: 2px;
  background: linear-gradient(90deg, var(--white) 42%, transparent);
}
.tg-tabbar__hint--end {
  right: 0;
  justify-content: flex-end;
  padding-right: 2px;
  background: linear-gradient(270deg, var(--white) 42%, transparent);
}
.tg-tabbar__hint svg {
  width: 16px;
  height: 16px;
  opacity: 0.4;
  fill: none;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tg-tabbar a {
  flex: 0 0 auto;
  width: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 72px;
  min-height: 56px;
  padding: 4px 8px;
  color: var(--muted);
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: var(--fw-ui, 600);
  line-height: 1.15;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
}
.tg-tabbar a svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tg-tabbar a.is-on { color: var(--primary); }
`;
