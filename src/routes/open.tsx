import { createFileRoute, redirect } from "@tanstack/react-router";

import { safeOpenPath } from "@/lib/mobile/paths";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/open")({
  validateSearch: (search: Record<string, unknown>): { path?: string } => ({
    path: typeof search.path === "string" ? search.path : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ href: safeOpenPath(search.path) });
  },
  head: () => ({
    meta: [{ title: "trenio.by" }, NOINDEX_FOLLOW],
  }),
  component: () => null,
});
