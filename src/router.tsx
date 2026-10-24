import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { PublicUser } from "@/lib/auth/schemas";
import { EMPTY_MESSAGING } from "@/lib/messages/schemas";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null as PublicUser | null, messaging: EMPTY_MESSAGING },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
