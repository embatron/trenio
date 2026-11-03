import { createFileRoute } from "@tanstack/react-router";

import { DoorPasswordDialog } from "@/components/auth/door-password-dialog";
import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/password")({
  head: () => ({
    meta: [
      { title: "Пароль кабинета — trenio.by" },
      NOINDEX_FOLLOW,
    ],
  }),
  component: PasswordPage,
});

function PasswordPage() {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main" />
      <SiteFooter />
      <DoorPasswordDialog />
    </div>
  );
}
