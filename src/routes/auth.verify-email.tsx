import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { NOINDEX_NOFOLLOW } from "@/lib/seo/head";

const searchSchema = z.object({
  token: z.string().optional(),
});

/** Old verification links land on set-password (email is confirmed when the password is saved). */
export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Подтверждение e-mail — trenio.by" }, NOINDEX_NOFOLLOW],
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth/set-password",
      search: search.token ? { token: search.token } : {},
    });
  },
  component: function VerifyEmailRedirect() {
    return null;
  },
});
