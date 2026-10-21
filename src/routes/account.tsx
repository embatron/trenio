import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetShell, type AccountSectionPath } from "@/components/cabinet";
import { logoutFn } from "@/lib/auth/functions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";

const SECTIONS: Array<{ id: string; label: string; icon: "reviews" | "bookings" | "favorites" | "profile"; to: AccountSectionPath }> = [
  { id: "reviews", label: "Мои отзывы", icon: "reviews", to: "/account/reviews" },
  { id: "bookings", label: "Мои записи", icon: "bookings", to: "/account/bookings" },
  { id: "favorites", label: "Избранное", icon: "favorites", to: "/account/favorites" },
  { id: "settings", label: "Параметры", icon: "profile", to: "/account/settings" },
];

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/account") ? location.pathname : "/account/reviews";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
  },
  loader: async () => {
    const [cabinet, ratings] = await Promise.all([getUserCabinetFn(), listTrainerRatingSummariesFn()]);
    return { cabinet, ratings };
  },
  component: AccountLayout,
});

function AccountLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active = SECTIONS.find((item) => pathname === item.to)?.id ?? "reviews";

  return (
    <CabinetShell
      title="Личный кабинет"
      lede="Ваши отзывы, записи и сохранённые карточки."
      name={name}
      role={role}
      avatarUrl={user.avatarPath || null}
      items={SECTIONS}
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
  );
}
