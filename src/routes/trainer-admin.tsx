import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AccountProfileForm } from "@/components/account-profile-form";
import { CabinetShell } from "@/components/cabinet";
import { TrainerProfileForm } from "@/components/trainer-profile-form";
import { logoutFn } from "@/lib/auth/functions";
import { hasAnyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getUserCabinetFn } from "@/lib/cabinet";
import { getOwnTrainerProfileFn } from "@/lib/catalog/trainer-own";
import { pluralRu } from "@/lib/ru-plural";

export const Route = createFileRoute("/trainer-admin")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/auth/login", search: { redirect: "/trainer-admin" } });
    }
    if (!hasAnyRole(context.user.roles, ["trainer", "club", "admin", "superadmin"])) {
      throw redirect({ to: "/" });
    }
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
    return { cabinet, trainer };
  },
  component: TrainerCabinetPage,
});

const TABS = [
  { id: "overview", label: "Обзор", icon: "overview" as const },
  { id: "settings", label: "Параметры", icon: "profile" as const },
  { id: "card", label: "Профиль тренера", icon: "trainers" as const },
  { id: "reviews", label: "Отзывы", icon: "reviews" as const },
];

function TrainerCabinetPage() {
  const { cabinet, trainer } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState("overview");
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");

  return (
    <CabinetShell
      title="Кабинет тренера"
      lede="Параметры — данные аккаунта. Профиль тренера — карточка для каталога."
      name={name}
      role={role}
      avatarUrl={user.avatarPath || null}
      items={trainer ? TABS : TABS.filter((item) => item.id !== "card")}
      active={tab}
      onSelect={setTab}
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
            <div className="cabinet-stat"><strong>0</strong><span>{pluralRu(0, "отзыв на профиле", "отзыва на профиле", "отзывов на профиле")}</span></div>
          </div>
          <article className="cabinet-card">
            <h2>Что уже есть</h2>
            <p className="cabinet-empty">
              {trainer
                ? `Аккаунт ${user.email} активен. Карточка редактируется в разделе «Профиль тренера» и попадает в каталог после публикации. Заявки и расписание здесь пока не показываются.`
                : `Аккаунт ${user.email} активен. Карточка в каталоге к нему пока не привязана, поэтому заявки и расписание здесь не показываются.`}
            </p>
          </article>
        </>
      ) : null}
      {tab === "settings" ? (
        <article className="cabinet-card">
          <h2>Параметры</h2>
          <AccountProfileForm user={user} phone={cabinet.phone} phoneVerified={cabinet.phoneVerified} />
        </article>
      ) : null}
      {tab === "card" && trainer ? (
        <article className="cabinet-card">
          <h2>Профиль тренера</h2>
          <TrainerProfileForm profile={trainer} />
        </article>
      ) : null}
      {tab === "reviews" ? (
        <article className="cabinet-card">
          <h2>Отзывы</h2>
          <p className="cabinet-empty">Когда профиль появится в каталоге, отзывы клиентов будут в этом списке.</p>
        </article>
      ) : null}
    </CabinetShell>
  );
}
