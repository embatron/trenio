import { createFileRoute, Outlet, redirect, useParams } from "@tanstack/react-router";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { useOpenTrainerThread } from "@/components/messages/open-trainer-thread";
import { hasAnyRole } from "@/lib/auth/roles";

export const Route = createFileRoute("/account/messages")({
  beforeLoad: ({ context, location, search }) => {
    if (!context.user || !hasAnyRole(context.user.roles, ["trainer", "club"])) return;
    const conversationId = location.pathname.match(/^\/account\/messages\/([0-9a-f-]{36})\/?$/i)?.[1];
    if (conversationId) {
      throw redirect({ to: "/me/messages/$conversationId", params: { conversationId } });
    }
    throw redirect({ to: "/me/messages", search: search.trainer ? { trainer: search.trainer } : {} });
  },
  validateSearch: (search: Record<string, unknown>) => {
    const trainer = typeof search.trainer === "string" ? search.trainer.trim().slice(0, 30) : "";
    return trainer ? { trainer } : {};
  },
  head: () => ({
    meta: [
      { title: "Сообщения · Я ищу тренера на trenio.by" },
      { name: "description", content: "Сообщения тренерам и клубам." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountMessagesPage,
});

function AccountMessagesPage() {
  const { trainer } = Route.useSearch();
  const params = useParams({ strict: false });
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : null;
  const validId = conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : null;
  const opened = useOpenTrainerThread(trainer, "/account/messages/$conversationId", validId);

  return (
    <>
      <MessagesWorkspace
        view="own"
        conversationId={validId}
        openError={conversationId && !validId ? "Переписка не найдена." : opened.error}
        holdOpen={opened.hold}
      />
      <Outlet />
    </>
  );
}
