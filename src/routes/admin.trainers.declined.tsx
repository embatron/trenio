import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/trainers/declined")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/trainers", search: { list: "declined" } });
  },
});