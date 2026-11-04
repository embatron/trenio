import { createFileRoute } from "@tanstack/react-router";
import { listCatalogSitemapPaths } from "@/lib/catalog/catalog-sports";
import { renderSitemapXml } from "@/lib/seo/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { listPublishedTrainerSitemapEntries } = await import("@/lib/seo/trainer-sitemap.server");
        const trainers = await listPublishedTrainerSitemapEntries();
        const body = renderSitemapXml(listCatalogSitemapPaths(), trainers);
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
