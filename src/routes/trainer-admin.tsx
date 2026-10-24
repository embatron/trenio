import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { hasAnyRole } from "@/lib/auth/roles";

const TRAINER_TABS = ["overview", "settings", "card", "reviews"] as const;
type TrainerTab = (typeof TRAINER_TABS)[number];

export const Route = createFileRoute("/trainer-admin")({
  validateSearch: (search: Record<string, unknown>): { tab?: TrainerTab } => {
    const tab = search.tab;
    return TRAINER_TABS.includes(tab as TrainerTab) ? { tab: tab as TrainerTab } : {};
  },
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      const next = `${location.pathname}${location.searchStr ?? ""}`;
      throw redirect({
        to: "/auth/login",
        search: { redirect: next.startsWith("/") && !next.startsWith("//") ? next.slice(0, 200) : "/trainer-admin" },
      });
    }
    if (!hasAnyRole(context.user.roles, ["trainer", "club", "admin", "superadmin"])) {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
