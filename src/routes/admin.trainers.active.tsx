import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/trainers/active")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/trainers", search: { list: "published" } });
  },
});
