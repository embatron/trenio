import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { CabinetShell, cabinetPathMatches, type AdminSectionPath, type CabinetIcon, type CabinetNavPage } from "@/components/cabinet";
import { useCabinetLive } from "@/components/cabinet-live";
import { useMessaging } from "@/components/messages/messages-live";
import { getAdminShellFn } from "@/lib/admin/shell";
import { logoutFn } from "@/lib/auth/functions";
import { logoutWithShell } from "@/lib/native/shell";
import { useLiveAvatar } from "@/lib/auth/live-avatar";
import { deniedCabinetTarget, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const TRAINER_PAGES: CabinetNavPage[] = [
  { id: "all", label: "Весь список", to: "/admin/trainers" },
  { id: "drafts", label: "Драфты", to: "/admin/trainers/drafts" },
  { id: "active", label: "Активные", to: "/admin/trainers/active" },
  { id: "unclear", label: "Непонятные", to: "/admin/trainers/unclear" },
  { id: "welcomes", label: "Заявки", to: "/admin/welcomes" },
  { id: "reviews", label: "Отзывы", to: "/admin/reviews" },
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
  const logout = useAuthServerFn(logoutFn);
  const face = useLiveAvatar(user?.id, user?.avatarPath);
  const messaging = useMessaging();
  const live = useCabinetLive();
  const counts = live?.staff ?? loaded;
  useLayoutEffect(() => {
    document.documentElement.classList.add("is-staff-layout");
    return () => document.documentElement.classList.remove("is-staff-layout");
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
        if (page.id === "drafts") return { ...page, badge: counts.draftsOpen };
        if (page.id === "active") return { ...page, badge: counts.publishedCount };
        if (page.id === "unclear") return { ...page, badge: counts.unclearCount };
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
          void logoutWithShell(() => logout())
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
