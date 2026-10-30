import { createFileRoute } from "@tanstack/react-router";
import { CATALOG_ORIGIN, listCatalogSitemapPaths } from "@/lib/catalog/catalog-sports";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...listCatalogSitemapPaths().map((path) => `  <url><loc>${CATALOG_ORIGIN}${path}</loc></url>`),
          ...["/about", "/contacts", "/offer", "/privacy", "/join/trainer"].map((path) => `  <url><loc>${CATALOG_ORIGIN}${path}</loc></url>`),
          `</urlset>`,
        ].join("\n");
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
