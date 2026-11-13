import { useRouter, useRouterState, useRouteContext } from "@tanstack/react-router";
import { useEffect, useLayoutEffect } from "react";

import { FAVORITE_BOOKMARK } from "@/components/favorite-mark";
import { MESSAGE_ENVELOPE } from "@/components/messages/direct-mark";
import { useMessaging } from "@/components/messages/messages-live";
import { hasAnyRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { shellBackLabel, shellLinkAction, shellThreadList } from "@/lib/mobile/detect";
import { currentShellKind, rememberAndroidShell } from "@/lib/mobile/shell-runtime";

type TabIcon = "search" | "bookmark" | "messages" | "profile" | "page" | "stats";

type Tab = {
  id: string;
  label: string;
  href: string;
  icon: TabIcon;
};

const ICONS: Record<TabIcon, readonly string[]> = {
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-3.5-3.5"],
  bookmark: [FAVORITE_BOOKMARK],
  messages: [MESSAGE_ENVELOPE],
  profile: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 16 0"],
  page: ["M6 3h9l4 4v14H6z", "M15 3v5h5", "M9 13h6", "M9 17h6"],
  stats: ["M5 19V10", "M12 19V5", "M19 19v-7"],
};

function tabsFor(roles: readonly UserRole[] | undefined, signedIn: boolean): Tab[] {
  if (roles && hasAnyRole(roles, ["admin", "superadmin"])) {
    return [
      { id: "search", label: "Поиск", href: "/", icon: "search" },
      { id: "messages", label: "Сообщения", href: "/admin/messages", icon: "messages" },
      { id: "profile", label: "Кабинет", href: "/admin", icon: "profile" },
    ];
  }
  if (roles && hasAnyRole(roles, ["trainer", "club"])) {
    return [
      { id: "search", label: "Поиск", href: "/", icon: "search" },
      { id: "page", label: "Страница", href: "/me/profile", icon: "page" },
      { id: "messages", label: "Сообщения", href: "/me/messages", icon: "messages" },
      { id: "stats", label: "Статистика", href: "/me/stats", icon: "stats" },
      { id: "profile", label: "Профиль", href: "/me", icon: "profile" },
    ];
  }
  const login = (path: string) => signedIn ? path : `/auth/login?redirect=${encodeURIComponent(path)}`;
  return [
    { id: "search", label: "Поиск", href: "/", icon: "search" },
    { id: "favorites", label: "Избранное", href: login("/account/favorites"), icon: "bookmark" },
    { id: "messages", label: "Сообщения", href: login("/account/messages"), icon: "messages" },
    { id: "profile", label: "Профиль", href: login("/account"), icon: "profile" },
  ];
}

function tabIsOn(pathname: string, tab: Tab): boolean {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (tab.id === "search") return path === "/";
  if (tab.id === "favorites") return path === "/account/favorites" || path === "/me/favorites";
  if (tab.id === "messages") return path === "/account/messages" || path === "/me/messages" || path === "/admin/messages";
  if (tab.id === "page") return path === "/me/profile";
  if (tab.id === "stats") return path === "/me/stats";
  if (tab.id === "profile") return path === "/account" || path === "/me" || path === "/admin";
  return path === tab.href;
}

function ShellIcon({ icon }: { icon: TabIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[icon].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function openExternal(href: string): void {
  void import("@capacitor/browser")
    .then(({ Browser }) => Browser.open({ url: href }))
    .catch(() => {
      window.open(href, "_blank", "noopener");
    });
}

export function NativeAppChrome() {
  const kind = currentShellKind();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useRouteContext({ from: "__root__" });
  const messaging = useMessaging();
  const router = useRouter();
  const back = kind ? shellBackLabel(pathname, kind) : null;

  useLayoutEffect(() => {
    rememberAndroidShell();
    document.documentElement.classList.toggle("app-native-back", back !== null);
  }, [back]);

  useEffect(() => {
    if (!kind) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const node = event.target;
      if (!(node instanceof Element)) return;
      const anchor = node.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const action = shellLinkAction({
        href: anchor.getAttribute("href") ?? "",
        origin: window.location.origin,
        target: anchor.getAttribute("target") ?? "",
      });
      if (!action) return;
      if (action.kind === "same") {
        event.preventDefault();
        void router.history.push(action.path);
        return;
      }
      if (kind === "ios") {
        event.preventDefault();
        openExternal(action.href);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [kind, router]);

  if (!kind) return null;
  const tabs = tabsFor(user?.roles, Boolean(user));

  return (
    <>
      <style>{TAB_CSS}</style>
      {back !== null ? (
        <button
          type="button"
          className={`shell-back${kind === "ios" ? " shell-back--ios" : ""}`}
          onClick={() => {
            const list = shellThreadList(pathname);
            if (list) {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              void router.navigate({ to: list, search: {}, replace: true });
              return;
            }
            if (window.history.length > 1) {
              window.history.back();
              return;
            }
            void router.history.push("/");
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={kind === "ios" ? "M14.5 5.5 8 12l6.5 6.5" : "M19 12H5M11 6l-6 6 6 6"} />
          </svg>
          {back ? <span>{back}</span> : <span className="shell-back__name">Назад</span>}
        </button>
      ) : null}
      <nav className="shell-tabs" aria-label="Разделы">
        {tabs.map((tab) => {
          const on = tabIsOn(pathname, tab);
          const unread = tab.id === "messages" ? messaging.total : 0;
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={on ? "is-on" : undefined}
              aria-current={on ? "page" : undefined}
              onClick={(event) => {
                if (!on) return;
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span className="shell-tabs__icon">
                <ShellIcon icon={tab.icon} />
                {unread > 0 ? <span className="shell-tabs__badge">{unread > 99 ? "99+" : unread}</span> : null}
              </span>
              <span>{tab.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}

const TAB_CSS = `
.shell-back {
  position: fixed;
  z-index: 45;
  top: env(safe-area-inset-top);
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0 12px 0 max(8px, env(safe-area-inset-left));
  border: 0;
  background: transparent;
  color: var(--dark);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.shell-back svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.shell-back--ios { color: var(--primary); }
.shell-back__name {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.shell-tabs {
  position: fixed;
  z-index: 40;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  min-height: 56px;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--white);
  border-top: 1px solid var(--line);
}
.shell-tabs a {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 44px;
  min-height: 44px;
  padding: 6px 2px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.2;
  text-decoration: none;
}
.shell-tabs a.is-on { color: var(--primary); }
.shell-tabs svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.shell-tabs__icon { position: relative; display: inline-flex; }
.shell-tabs__badge {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 10px;
  font-weight: var(--fw-title);
  line-height: 16px;
  text-align: center;
}
`;
