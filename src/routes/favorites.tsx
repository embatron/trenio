import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/favorites")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/auth/login", search: { redirect: "/account/favorites" } });
    }
    throw redirect({ to: "/account/favorites" });
  },
});
