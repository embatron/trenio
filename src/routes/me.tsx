import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetShell, type MeSectionPath } from "@/components/cabinet";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { TRAINER_PROFILE_SECTIONS } from "@/components/trainer-card-fields";
import { logoutFn } from "@/lib/auth/functions";
import { hasAnyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { getOwnTrainerProfileFn } from "@/lib/catalog/trainer-own";
import { listOwnTrainerReviewsFn, listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { getOwnTrainerViewStatsFn } from "@/lib/catalog/trainer-views";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

const SECTIONS: Array<{ id: string; label: string; icon: "overview" | "profile" | "trainers" | "reviews" | "favorites" | "messages"; to: MeSectionPath; sections?: typeof TRAINER_PROFILE_SECTIONS }> = [
  { id: "overview", label: "Обзор", icon: "overview", to: "/me" },
  { id: "messages", label: "Сообщения", icon: "messages", to: "/me/messages" },
  { id: "profile", label: "Профиль", icon: "trainers", to: "/me/profile", sections: TRAINER_PROFILE_SECTIONS },
  { id: "reviews", label: "Отзывы", icon: "reviews", to: "/me/reviews" },
  { id: "favorites", label: "Избранное", icon: "favorites", to: "/me/favorites" },
  { id: "settings", label: "Настройки", icon: "profile", to: "/me/settings" },
];

export const Route = createFileRoute("/me")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/me") ? location.pathname : "/me";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
    if (!hasAnyRole(context.user.roles, ["trainer", "club", "admin", "superadmin"])) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Кабинет тренера — trenio.by" }, NOINDEX_FOLLOW] }),
  loader: async ({ context }) => {
    const isTrainer = Boolean(context.user && hasAnyRole(context.user.roles, ["trainer", "club"]));
    const [cabinet, ratings, prices, trainer, reviews, views] = await Promise.all([
      getUserCabinetFn(),
      listTrainerRatingSummariesFn(),
      listTrainerPricesFn(),
      isTrainer ? getOwnTrainerProfileFn() : Promise.resolve(null),
      isTrainer ? listOwnTrainerReviewsFn() : Promise.resolve([]),
      isTrainer ? getOwnTrainerViewStatsFn() : Promise.resolve(null),
    ]);
    return { cabinet, ratings, prices, trainer, reviews, views };
  },
  component: MeLayout,
});

function MeLayout() {
  const { user } = Route.useRouteContext();
  const { trainer, reviews } = Route.useLoaderData();
  const messaging = useMessaging();
  const { keys, ready } = useFavorites();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active = pathname.startsWith("/me/messages")
    ? "messages"
    : pathname === "/me" || pathname === "/me/"
      ? "overview"
      : SECTIONS.find((item) => pathname === item.to)?.id ?? "overview";
  const face = trainer?.photos[0] || trainer?.avatarPath || user.avatarPath || null;
  const items = SECTIONS.filter((item) => item.id !== "profile" || trainer).map((item) => {
    if (item.id === "messages") return { ...item, badge: messaging.inbox + messaging.own };
    if (item.id === "reviews") return { ...item, badge: reviews.length };
    if (item.id === "favorites") return { ...item, badge: ready ? keys.length : undefined };
    if (item.id !== "profile") return item;
    return active === "profile" ? item : { ...item, sections: undefined };
  });

  return (
    <CabinetShell
      title="Личный кабинет"
      lede="Ваши сообщения, отзывы и сохранённые карточки."
      firstName={user.firstName}
      lastName={user.lastName}
      role={role}
      profileSlug={trainer?.slug}
      avatarUrl={face}
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
