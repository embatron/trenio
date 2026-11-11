import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetShell, type CabinetIcon, type MeSectionPath } from "@/components/cabinet";
import { useCabinetLive } from "@/components/cabinet-live";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { TRAINER_PROFILE_SECTIONS } from "@/components/trainer-card-fields";
import { logoutFn } from "@/lib/auth/functions";
import { useLiveAvatar } from "@/lib/auth/live-avatar";
import { deniedCabinetTarget, hasAnyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { listTrainerPricesFn } from "@/lib/catalog/trainer-price";
import { getOwnTrainerProfileFn } from "@/lib/catalog/trainer-own";
import { listOwnTrainerReviewsFn, listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { getOwnTrainerViewStatsFn } from "@/lib/catalog/trainer-views";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

const ME_PAGE_SECTIONS = [
  { id: "trainer-page-status", label: "Статус" },
  { id: "trainer-contact-block", label: "Контакты" },
  ...TRAINER_PROFILE_SECTIONS,
];

const SECTIONS: Array<{ id: string; label: string; icon: CabinetIcon; to: MeSectionPath; sections?: typeof ME_PAGE_SECTIONS }> = [
  { id: "overview", label: "Общая панель", icon: "overview", to: "/me" },
  { id: "stats", label: "Моя статистика", icon: "stats", to: "/me/stats" },
  { id: "profile", label: "Моя страница", icon: "trainers", to: "/me/profile", sections: ME_PAGE_SECTIONS },
  { id: "messages", label: "Мои сообщения", icon: "messages", to: "/me/messages" },
  { id: "reviews", label: "Мои отзывы", icon: "reviews", to: "/me/reviews" },
  { id: "likes", label: "Мои лайкосы", icon: "likes", to: "/me/likes" },
  { id: "favorites", label: "Избранное", icon: "favorites", to: "/me/favorites" },
  { id: "settings", label: "Настройки", icon: "profile", to: "/me/settings" },
];

export const Route = createFileRoute("/me")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = location.pathname.startsWith("/me") ? location.pathname : "/me";
      throw redirect({ to: "/auth/login", search: { redirect: next } });
    }
    const away = deniedCabinetTarget("me", context.user.roles);
    if (away) throw redirect({ href: away });
  },
  head: () => ({ meta: [{ title: "Личный кабинет тренера — Я ищу тренера на trenio.by" }, NOINDEX_FOLLOW] }),
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
  const { trainer, reviews, views } = Route.useLoaderData();
  const messaging = useMessaging();
  const live = useCabinetLive();
  const { keys, ready } = useFavorites();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  const accountFace = useLiveAvatar(user?.id, user?.avatarPath);
  if (!user) return null;

  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const active = pathname.startsWith("/me/messages")
    ? "messages"
    : pathname === "/me" || pathname === "/me/"
      ? "overview"
      : SECTIONS.find((item) => pathname === item.to)?.id ?? "overview";
  const face = trainer?.photos[0] || trainer?.avatarPath || accountFace || null;
  const items = SECTIONS.filter((item) => item.id !== "profile" || trainer).map((item) => {
    if (item.id === "messages") return { ...item, badge: messaging.total };
    if (item.id === "reviews") return { ...item, badge: live ? live.trainerReviews : reviews.length };
    if (item.id === "likes") return { ...item, badge: live ? live.trainerLikes : views?.likes.total ?? 0 };
    if (item.id === "favorites") return { ...item, badge: ready ? keys.length : undefined };
    if (item.id !== "profile") return item;
    return active === "profile" ? item : { ...item, sections: undefined };
  });

  return (
    <CabinetShell
      title="Личный кабинет тренера"
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
            window.location.href = "/";
          })
          .finally(() => setPending(false));
      }}
    >
      <Outlet />
    </CabinetShell>
  );
}
