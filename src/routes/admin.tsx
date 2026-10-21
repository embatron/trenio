import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetShell, type AdminSectionPath, type CabinetIcon } from "@/components/cabinet";
import { getAdminShellFn } from "@/lib/admin/shell";
import { logoutFn } from "@/lib/auth/functions";
import { isStaff, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const SECTIONS: Array<{ id: string; label: string; icon: CabinetIcon; to: AdminSectionPath }> = [
  { id: "overview", label: "Обзор", icon: "overview", to: "/admin" },
  { id: "trainers", label: "Тренеры", icon: "trainers", to: "/admin/trainers" },
  { id: "reviews", label: "Отзывы", icon: "reviews", to: "/admin/reviews" },
  { id: "accounts", label: "Аккаунты", icon: "accounts", to: "/admin/accounts" },
  { id: "finance", label: "Бухгалтерия", icon: "finance", to: "/admin/finance" },
  { id: "settings", label: "Параметры", icon: "profile", to: "/admin/settings" },
];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/admin") ? location.pathname : "/admin";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
    if (!isStaff(context.user.roles)) {
      throw redirect({ to: context.user.roles.some((role) => role === "trainer" || role === "club") ? "/trainer-admin" : "/" });
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
  const { reviewsPending } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active = [...SECTIONS].reverse().find((item) => pathname === item.to || (item.to !== "/admin" && pathname.startsWith(`${item.to}/`)))?.id
    ?? "overview";
  const items = SECTIONS.map((item) => (
    item.id === "reviews" && reviewsPending > 0 ? { ...item, label: `Отзывы · ${reviewsPending}` } : item
  ));

  return (
    <div className="layout-staff">
      <CabinetShell
        title="Кабинет администратора"
        name={name}
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
