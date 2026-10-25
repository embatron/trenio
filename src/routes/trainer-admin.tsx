import { createFileRoute, redirect } from "@tanstack/react-router";

const TRAINER_TABS = ["overview", "settings", "card", "reviews"] as const;
type TrainerTab = (typeof TRAINER_TABS)[number];

function mePath(pathname: string, tab: TrainerTab | undefined): string {
  if (pathname.startsWith("/trainer-admin/messages")) {
    return `/me/messages${pathname.slice("/trainer-admin/messages".length)}`;
  }
  if (tab === "settings") return "/me/settings";
  if (tab === "card") return "/me/profile";
  if (tab === "reviews") return "/me/reviews";
  return "/me";
}

export const Route = createFileRoute("/trainer-admin")({
  validateSearch: (search: Record<string, unknown>): { tab?: TrainerTab } => {
    const tab = search.tab;
    return TRAINER_TABS.includes(tab as TrainerTab) ? { tab: tab as TrainerTab } : {};
  },
  beforeLoad: ({ context, location }) => {
    const tab = new URLSearchParams(location.searchStr.replace(/^\?/, "")).get("tab");
    const dest = mePath(
      location.pathname,
      tab === "settings" || tab === "card" || tab === "reviews" || tab === "overview" ? tab : undefined,
    );
    if (!context.user) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: dest.startsWith("/") && !dest.startsWith("//") ? dest.slice(0, 200) : "/me" },
      });
    }
    throw redirect({ href: dest });
  },
});
