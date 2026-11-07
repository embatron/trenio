import { createFileRoute } from "@tanstack/react-router";
import { renderSitemapXml } from "@/lib/seo/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { listIndexableCatalogPaths, listPublishedTrainerSitemapEntries } = await import("@/lib/seo/trainer-sitemap.server");
        const [catalogPaths, trainers] = await Promise.all([
          listIndexableCatalogPaths(),
          listPublishedTrainerSitemapEntries(),
        ]);
        const body = renderSitemapXml(catalogPaths, trainers);
        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
