import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/trainers/drafts")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/trainers", search: { list: "unvisited" } });
  },
});
