import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/messages/files/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const preview = new URL(request.url).searchParams.get("preview") === "1";
        const { sendMessageFile } = await import("@/lib/messages/file-download");
        return sendMessageFile(params.id, preview);
      },
    },
  },
});
