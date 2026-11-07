import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { CabinetShell, cabinetPathMatches, type AdminSectionPath, type CabinetIcon, type CabinetNavPage } from "@/components/cabinet";
import { useMessaging } from "@/components/messages/messages-live";
import { getAdminShellFn } from "@/lib/admin/shell";
import { MESSAGE_SCAN_MS } from "@/lib/messages/polling";
import { logoutFn } from "@/lib/auth/functions";
import { useLiveAvatar } from "@/lib/auth/live-avatar";
import { deniedCabinetTarget, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const TRAINER_PAGES: CabinetNavPage[] = [
  { id: "welcomes", label: "Заявки", to: "/admin/welcomes" },
  { id: "reviews", label: "Отзывы", to: "/admin/reviews" },
  { id: "drafts", label: "Драфты", to: "/admin/trainers/drafts" },
];

const SETTINGS_PAGES: CabinetNavPage[] = [
  { id: "account", label: "Аккаунт", to: "/admin/settings" },
  { id: "site", label: "Сайт", to: "/admin/site" },
];

const SECTIONS: Array<{ id: string; label: string; icon: CabinetIcon; to: AdminSectionPath; pages?: CabinetNavPage[] }> = [
  { id: "overview", label: "Обзор", icon: "overview", to: "/admin" },
  { id: "trainers", label: "Тренеры", icon: "trainers", to: "/admin/trainers", pages: TRAINER_PAGES },
  { id: "messages", label: "Сообщения", icon: "messages", to: "/admin/messages" },
  { id: "accounts", label: "Аккаунты", icon: "accounts", to: "/admin/accounts" },
  { id: "finance", label: "Бухгалтерия", icon: "finance", to: "/admin/finance" },
  { id: "settings", label: "Настройки", icon: "profile", to: "/admin/settings", pages: SETTINGS_PAGES },
];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/admin") ? location.pathname : "/admin";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
    const away = deniedCabinetTarget("admin", context.user.roles);
    if (away) throw redirect({ href: away });
  },
  loader: () => getAdminShellFn(),
  head: () => ({
    meta: [
      { title: "Кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Каталог, отзывы и аккаунты trenio.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const loaded = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const [counts, setCounts] = useState(loaded);
  const shell = useServerFn(getAdminShellFn);
  const shellRef = useRef(shell);
  shellRef.current = shell;
  const logout = useAuthServerFn(logoutFn);
  const face = useLiveAvatar(user?.id, user?.avatarPath);
  const messaging = useMessaging();
  useLayoutEffect(() => {
    document.documentElement.classList.add("is-staff-layout");
    return () => document.documentElement.classList.remove("is-staff-layout");
  }, []);
  useEffect(() => {
    setCounts(loaded);
  }, [loaded]);
  useEffect(() => {
    let stop = false;
    let timer = 0;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await shellRef.current();
        if (!stop) setCounts(next);
      } catch {
        /* keep the last counts */
      }
    };
    const loop = () => {
      timer = window.setTimeout(() => {
        void tick().finally(() => {
          if (!stop) loop();
        });
      }, MESSAGE_SCAN_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  if (!user) return null;

  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active =
    [...SECTIONS]
      .reverse()
      .find(
        (item) =>
          item.pages?.some((page) => cabinetPathMatches(pathname, page.to)) ||
          cabinetPathMatches(pathname, item.to),
      )?.id ?? "overview";
  const items = SECTIONS.map((item) => {
    if (item.id === "messages") return { ...item, badge: messaging.total };
    if (item.id !== "trainers" || !item.pages) return item;
    return {
      ...item,
      pages: item.pages.map((page) => {
        if (page.id === "welcomes") return { ...page, badge: counts.welcomesOpen };
        if (page.id === "reviews") return { ...page, badge: counts.reviewsPending };
        return page;
      }),
    };
  });

  return (
    <div className="layout-staff">
      <CabinetShell
        title="Кабинет администратора"
        firstName={user.firstName}
        lastName={user.lastName}
        role={role}
        avatarUrl={face || null}
        items={items}
        active={active}
        logoutPending={pending}
        onLogout={() => {
          setPending(true);
          void logout()
            .then(() => {
              window.location.href = "/";
            })
            .finally(() => setPending(false));
        }}
      >
        <Outlet />
      </CabinetShell>
    </div>
  );
}
