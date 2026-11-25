import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/trainers/unclear")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/trainers", search: { list: "unclear" } });
  },
});
