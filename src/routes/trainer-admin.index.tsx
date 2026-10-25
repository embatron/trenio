import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { AccountProfileForm } from "@/components/account-profile-form";
import { CabinetShell } from "@/components/cabinet";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { TRAINER_PROFILE_SECTIONS } from "@/components/trainer-card-fields";
import { TrainerProfileForm } from "@/components/trainer-profile-form";
import { TrainerReviewsPanel } from "@/components/trainer-reviews-panel";
import { logoutFn } from "@/lib/auth/functions";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { hasAnyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { getOwnTrainerProfileFn } from "@/lib/catalog/trainer-own";
import { listOwnTrainerReviewsFn } from "@/lib/catalog/trainer-reviews";
import { pluralRu } from "@/lib/ru-plural";

const TRAINER_TABS = ["overview", "settings", "card", "reviews"] as const;
type TrainerTab = (typeof TRAINER_TABS)[number];

export const Route = createFileRoute("/trainer-admin/")({
  validateSearch: (search: Record<string, unknown>): { tab?: TrainerTab } => {
    const tab = search.tab;
    return TRAINER_TABS.includes(tab as TrainerTab) ? { tab: tab as TrainerTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Кабинет тренера · trenio.by" },
      { name: "description", content: "Личный кабинет тренера: профиль и отзывы." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ context }) => {
    const cabinet = await getUserCabinetFn();
    const isTrainer = Boolean(context.user && hasAnyRole(context.user.roles, ["trainer", "club"]));
    const trainer = isTrainer ? await getOwnTrainerProfileFn() : null;
    const reviews = isTrainer ? await listOwnTrainerReviewsFn() : [];
    return { cabinet, trainer, reviews };
  },
  component: TrainerCabinetPage,
});

const TABS = [
  { id: "overview", label: "Обзор", icon: "overview" as const },
  { id: "settings", label: "Настройки", icon: "profile" as const },
  { id: "card", label: "Профиль тренера", icon: "trainers" as const, sections: TRAINER_PROFILE_SECTIONS },
  { id: "reviews", label: "Отзывы", icon: "reviews" as const },
];

function TrainerCabinetPage() {
  const { cabinet, trainer, reviews } = Route.useLoaderData();
  const { tab: requestedTab } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const messaging = useMessaging();
  const { keys, ready } = useFavorites();
  const [tab, setTab] = useState<TrainerTab>(requestedTab === "card" && !trainer ? "overview" : requestedTab ?? "overview");
  const [enterCard, setEnterCard] = useState(false);
  const [pending, setPending] = useState(false);
  useLayoutEffect(() => {
    const key = "trenio-trainer-profile-card";
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; } catch { seen = true; }
    if (seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      return;
    }
    setEnterCard(true);
  }, []);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");
  const profileFace = trainer?.photos[0] || trainer?.avatarPath || null;

  return (
    <CabinetShell
      title="Кабинет тренера"
      lede="Настройки — данные аккаунта. Профиль тренера — карточка для каталога."
      firstName={user.firstName}
      lastName={user.lastName}
      role={role}
      avatarUrl={profileFace || user.avatarPath || null}
      items={[
        ...(trainer ? TABS : TABS.filter((item) => item.id !== "card")).map((item) => (
          item.id === "reviews" ? { ...item, badge: reviews.length } : item
        )),
        { id: "favorites", label: "Избранное", icon: "favorites" as const, to: "/account/favorites" as const, badge: ready ? keys.length : undefined },
        { id: "messages", label: "Сообщения", icon: "messages" as const, to: "/trainer-admin/messages" as const, badge: messaging.inbox },
      ]}
      active={tab}
      onSelect={(id) => {
        if (TRAINER_TABS.includes(id as TrainerTab)) setTab(id as TrainerTab);
      }}
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
      {tab === "overview" ? (
        <>
          <div className="cabinet-stats">
            <div className="cabinet-stat"><strong>—</strong><span>Публичный профиль</span></div>
            <div className="cabinet-stat"><strong>{reviews.filter((review) => review.status === "published").length}</strong><span>{pluralRu(reviews.filter((review) => review.status === "published").length, "отзыв на профиле", "отзыва на профиле", "отзывов на профиле")}</span></div>
          </div>
          <article className="cabinet-card">
            <h2>Что уже есть</h2>
            <p className="cabinet-empty">
              {trainer
                ? `Аккаунт ${displayAccountLogin(user.email)} активен. Карточка редактируется в разделе «Профиль тренера» и попадает в каталог после публикации. Заявки и расписание здесь пока не показываются.`
                : `Аккаунт ${displayAccountLogin(user.email)} активен. Карточка в каталоге к нему пока не привязана, поэтому заявки и расписание здесь не показываются.`}
            </p>
          </article>
        </>
      ) : null}
      {tab === "settings" ? (
        <article className="cabinet-card">
          <h2>Настройки</h2>
          <AccountProfileForm user={user} phone={cabinet.phone} phoneVerified={cabinet.phoneVerified} profilePhoto={profileFace} />
        </article>
      ) : null}
      {tab === "card" && trainer ? (
        <article
          className={enterCard ? "cabinet-card profile-card-enter" : "cabinet-card"}
          onAnimationEnd={() => {
            try { localStorage.setItem("trenio-trainer-profile-card", "1"); } catch { /* ignore */ }
          }}
        >
          <h2>Профиль тренера</h2>
          <TrainerProfileForm profile={trainer} />
        </article>
      ) : null}
      {tab === "reviews" ? (
        <article className="cabinet-card">
          <h2>Отзывы</h2>
          {trainer ? <TrainerReviewsPanel reviews={reviews} /> : <p className="cabinet-empty">Карточка ещё не привязана, поэтому отзывов нет.</p>}
        </article>
      ) : null}
    </CabinetShell>
  );
}
