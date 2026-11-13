import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { CabinetShell } from "@/components/cabinet";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { logoutFn } from "@/lib/auth/functions";
import { logoutWithShell } from "@/lib/native/shell";
import { useLiveAvatar } from "@/lib/auth/live-avatar";
import { hasAnyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { listOwnTrainerReviewsFn } from "@/lib/catalog/trainer-reviews";
import { useState } from "react";

export const Route = createFileRoute("/trainer-admin/messages")({
  head: () => ({
    meta: [
      { title: "Сообщения · кабинет тренера · Я ищу тренера на trenio.by" },
      { name: "description", content: "Сообщения клиентов." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ context }) => {
    const isTrainer = Boolean(context.user && hasAnyRole(context.user.roles, ["trainer", "club"]));
    const reviews = isTrainer ? await listOwnTrainerReviewsFn() : [];
    return { reviewCount: reviews.length };
  },
  component: TrainerMessagesPage,
});

function TrainerMessagesPage() {
  const { reviewCount } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const messaging = useMessaging();
  const { keys, ready } = useFavorites();
  const params = useParams({ strict: false });
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : null;
  const validId = conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : null;
  const [pending, setPending] = useState(false);
  const logout = useAuthServerFn(logoutFn);
  const face = useLiveAvatar(user?.id, user?.avatarPath);
  if (!user) return null;
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");

  return (
    <>
      <CabinetShell
        title="Кабинет тренера"
        lede="Сообщения от клиентов."
        firstName={user.firstName}
        lastName={user.lastName}
        role={role}
        avatarUrl={face || null}
        items={[
          { id: "overview", label: "Обзор", icon: "overview", to: "/trainer-admin" },
          { id: "reviews", label: "Отзывы", icon: "reviews", to: "/trainer-admin", search: { tab: "reviews" }, badge: reviewCount },
          { id: "favorites", label: "Избранное", icon: "favorites", to: "/account/favorites", badge: ready ? keys.length : undefined },
          { id: "messages", label: "Мои сообщения", icon: "messages", to: "/trainer-admin/messages", badge: messaging.total },
        ]}
        active="messages"
        logoutPending={pending}
        onLogout={() => {
          setPending(true);
          void logoutWithShell(() => logout()).then(() => {
            window.location.href = "/";
          }).finally(() => setPending(false));
        }}
      >
        <MessagesWorkspace
          view="inbox"
          conversationId={validId}
          openError={conversationId && !validId ? "Переписка не найдена." : null}
        />
      </CabinetShell>
      <Outlet />
    </>
  );
}
