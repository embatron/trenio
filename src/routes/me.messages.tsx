import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { useOpenTrainerThread } from "@/components/messages/open-trainer-thread";

export const Route = createFileRoute("/me/messages")({
  validateSearch: (search: Record<string, unknown>) => {
    const trainer = typeof search.trainer === "string" ? search.trainer.trim().slice(0, 30) : "";
    return trainer ? { trainer } : {};
  },
  head: () => ({
    meta: [
      { title: "Сообщения · Я ищу тренера на trenio.by" },
      { name: "description", content: "Сообщения клиентов и диалоги с другими тренерами." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeMessagesPage,
});

function MeMessagesPage() {
  const { trainer } = Route.useSearch();
  const params = useParams({ strict: false });
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : null;
  const validId = conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : null;
  const opened = useOpenTrainerThread(trainer, "/me/messages/$conversationId", validId);

  return (
    <>
      <MessagesWorkspace
        view="inbox"
        conversationId={validId}
        openError={conversationId && !validId ? "Переписка не найдена." : opened.error}
        holdOpen={opened.hold}
      />
      <Outlet />
    </>
  );
}
