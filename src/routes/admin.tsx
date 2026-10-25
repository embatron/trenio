import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { CabinetShell, type AdminSectionPath, type CabinetIcon } from "@/components/cabinet";
import { getAdminShellFn } from "@/lib/admin/shell";
import { MESSAGE_SCAN_MS } from "@/lib/messages/polling";
import { logoutFn } from "@/lib/auth/functions";
import { isStaff, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const SECTIONS: Array<{ id: string; label: string; icon: CabinetIcon; to: AdminSectionPath }> = [
  { id: "overview", label: "Обзор", icon: "overview", to: "/admin" },
  { id: "trainers", label: "Тренеры", icon: "trainers", to: "/admin/trainers" },
  { id: "reviews", label: "Отзывы", icon: "reviews", to: "/admin/reviews" },
  { id: "messages", label: "Сообщения", icon: "messages", to: "/admin/messages" },
  { id: "accounts", label: "Аккаунты", icon: "accounts", to: "/admin/accounts" },
  { id: "finance", label: "Бухгалтерия", icon: "finance", to: "/admin/finance" },
  { id: "settings", label: "Настройки", icon: "profile", to: "/admin/settings" },
];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/admin") ? location.pathname : "/admin";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
    if (!isStaff(context.user.roles)) {
      throw redirect({ to: context.user.roles.some((role) => role === "trainer" || role === "club") ? "/me" : "/" });
    }
  },
  loader: () => getAdminShellFn(),
  head: () => ({
    meta: [
      { title: "Кабинет администратора · trenio.by" },
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
  const active = [...SECTIONS].reverse().find((item) => pathname === item.to || (item.to !== "/admin" && pathname.startsWith(`${item.to}/`)))?.id
    ?? "overview";
  const items = SECTIONS.map((item) => {
    if (item.id === "reviews") return { ...item, badge: counts.reviewsPending };
    if (item.id === "messages") return { ...item, badge: counts.messageReportsNew };
    return item;
  });

  return (
    <div className="layout-staff">
      <CabinetShell
        title="Кабинет администратора"
        firstName={user.firstName}
        lastName={user.lastName}
        role={role}
        avatarUrl={user.avatarPath || null}
        items={items}
        active={active}
        logoutPending={pending}
        onLogout={() => {
          setPending(true);
          void logout()
            .then(() => {
              window.location.href = "/auth/login";
            })
            .finally(() => setPending(false));
        }}
      >
        <Outlet />
      </CabinetShell>
    </div>
  );
}
