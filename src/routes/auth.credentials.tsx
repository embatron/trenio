import { createFileRoute } from "@tanstack/react-router";

import { CredentialsRequiredDialog } from "@/components/auth/credentials-required-dialog";
import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/credentials")({
  head: () => ({
    meta: [
      { title: "Почта и пароль — Я ищу тренера на trenio.by" },
      NOINDEX_FOLLOW,
    ],
  }),
  component: CredentialsPage,
});

function CredentialsPage() {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main" />
      <SiteFooter />
      <CredentialsRequiredDialog />
    </div>
  );
}
