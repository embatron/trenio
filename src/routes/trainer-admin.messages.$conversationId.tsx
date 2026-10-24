import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/trainer-admin/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Переписка · кабинет тренера · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: () => null,
});
