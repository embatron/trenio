import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { PublicUser } from "@/lib/auth/schemas";
import { isAuthorizationRequired } from "@/lib/auth/errors";
import { redirectToLogin } from "@/lib/auth/return-path";
import { EMPTY_MESSAGING } from "@/lib/messages/schemas";

export const getRouter = () => {
  const onError = (error: unknown) => {
    if (isAuthorizationRequired(error)) redirectToLogin();
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      user: null as PublicUser | null,
      messaging: EMPTY_MESSAGING,
      likeCounts: {} as Record<string, number>,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
