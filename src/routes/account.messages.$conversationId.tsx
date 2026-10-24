import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Переписка · trenio.by" },
      { name: "description", content: "Диалог с тренером или клубом." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: () => null,
});
