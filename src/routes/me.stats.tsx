import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/me/stats")({
  beforeLoad: () => {
    throw redirect({ href: "/me#cabinet-stats" });
  },
});
