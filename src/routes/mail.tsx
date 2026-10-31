import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasAnyRole } from "@/lib/auth/roles";

export const Route = createFileRoute("/mail")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/auth/login", search: { redirect: "/mail" } });
    }
    const path = hasAnyRole(context.user.roles, ["trainer", "club"])
      ? "/me/settings"
      : hasAnyRole(context.user.roles, ["admin", "superadmin"])
        ? "/admin/settings"
        : "/account/settings";
    throw redirect({ href: `${path}#mail` });
  },
});
