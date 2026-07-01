import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { PublicUser } from "@/lib/auth/schemas";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null as PublicUser | null },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
