import { createFileRoute, Outlet, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { authErrorMessage } from "@/lib/auth/errors";
import { hasAnyRole } from "@/lib/auth/roles";
import { ensureConversationFn } from "@/lib/messages/functions";

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
      { title: "Сообщения · trenio.by" },
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
          to: "/account/messages/$conversationId",
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
  }, [trainer]);

  return (
    <>
      <MessagesWorkspace
        view="own"
        conversationId={validId}
        openError={conversationId && !validId ? "Переписка не найдена." : error}
      />
      <Outlet />
    </>
  );
}
