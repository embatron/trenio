import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/me/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Переписка · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: () => null,
});
