import { createFileRoute, isRedirect, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { confirmEmailChangeFn } from "@/lib/auth/functions";
import { NOINDEX_NOFOLLOW } from "@/lib/seo/head";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/auth/confirm-email")({
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const token = new URLSearchParams(location.searchStr).get("token") ?? undefined;
    if (!token) {
      return { status: "missing" as const };
    }
    try {
      await confirmEmailChangeFn({ data: { token } });
      throw redirect({ to: "/account" });
    } catch (error) {
      if (isRedirect(error)) throw error;
      return { status: "error" as const };
    }
  },
  head: () => ({
    meta: [
      { title: "Подтверждение e-mail — trenio.by" },
      NOINDEX_NOFOLLOW,
      { name: "description", content: "Подтвердите новый e-mail для аккаунта trenio.by." },
    ],
  }),
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  const { status } = Route.useLoaderData();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">Ссылка недействительна</h1>
            <p className="auth-sub">
              {status === "missing"
                ? "В ссылке нет токена. Запросите смену e-mail ещё раз в кабинете."
                : "Ссылка устарела или уже использована."}
            </p>
          </div>
          <Link
            to="/account"
            className="auth-submit"
            style={{ display: "grid", placeItems: "center", textDecoration: "none" }}
          >
            В кабинет
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
