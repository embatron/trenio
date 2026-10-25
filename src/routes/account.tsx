import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetShell, type AccountSectionPath } from "@/components/cabinet";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { logoutFn } from "@/lib/auth/functions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";

const SECTIONS: Array<{ id: string; label: string; icon: "reviews" | "bookings" | "favorites" | "profile" | "messages"; to: AccountSectionPath }> = [
  { id: "messages", label: "Сообщения", icon: "messages", to: "/account/messages" },
  { id: "reviews", label: "Мои отзывы", icon: "reviews", to: "/account/reviews" },
  { id: "bookings", label: "Мои записи", icon: "bookings", to: "/account/bookings" },
  { id: "favorites", label: "Избранное", icon: "favorites", to: "/account/favorites" },
  { id: "settings", label: "Настройки", icon: "profile", to: "/account/settings" },
];

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/account") ? location.pathname : "/account/reviews";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
  },
  loader: async () => {
    const [cabinet, ratings, prices] = await Promise.all([getUserCabinetFn(), listTrainerRatingSummariesFn(), listTrainerPricesFn()]);
    return { cabinet, ratings, prices };
  },
  component: AccountLayout,
});

function AccountLayout() {
  const { user } = Route.useRouteContext();
  const { cabinet } = Route.useLoaderData();
  const messaging = useMessaging();
  const { keys, ready } = useFavorites();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active = pathname.startsWith("/account/messages")
    ? "messages"
    : SECTIONS.find((item) => pathname === item.to)?.id ?? "reviews";
  const items = SECTIONS.map((item) => {
    if (item.id === "messages") return { ...item, badge: messaging.own };
    if (item.id === "reviews") return { ...item, badge: cabinet.reviews.length };
    if (item.id === "bookings") return { ...item, badge: 0 };
    if (item.id === "favorites") return { ...item, badge: ready ? keys.length : undefined };
    return item;
  });

  return (
    <CabinetShell
      title="Личный кабинет"
      lede="Ваши сообщения, отзывы и сохранённые карточки."
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
  );
}
