import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og/trainers/$slug.jpg")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { trainerShareJpeg } = await import("@/lib/images/share-card.server");
        const body = await trainerShareJpeg(params.slug);
        if (!body) {
          return new Response(null, {
            status: 404,
            headers: { "cache-control": "public, max-age=60" },
          });
        }
        return new Response(new Uint8Array(body), {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
