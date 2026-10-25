import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { authErrorMessage } from "@/lib/auth/errors";
import { ensureConversationFn } from "@/lib/messages/functions";

export const Route = createFileRoute("/me/messages")({
  validateSearch: (search: Record<string, unknown>) => {
    const trainer = typeof search.trainer === "string" ? search.trainer.trim().slice(0, 30) : "";
    return trainer ? { trainer } : {};
  },
  head: () => ({
    meta: [
      { title: "Сообщения · trenio.by" },
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
  const navigate = useNavigate();
  const ensure = useServerFn(ensureConversationFn);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trainer) return;
    let cancelled = false;
    setError(null);
    void ensure({ data: { trainerProfileSlug: trainer } })
      .then((result) => {
        if (cancelled) return;
        void navigate({
          to: "/me/messages/$conversationId",
          params: { conversationId: result.conversationId },
          replace: true,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [trainer, ensure, navigate]);

  useEffect(() => {
    if (!trainer || !validId) return;
    void navigate({
      to: "/me/messages/$conversationId",
      params: { conversationId: validId },
      search: {},
      replace: true,
    });
  }, [trainer, validId, navigate]);

  return (
    <>
      <MessagesWorkspace
        view="inbox"
        conversationId={validId}
        openError={conversationId && !validId ? "Переписка не найдена." : error}
      />
      <Outlet />
    </>
  );
}
