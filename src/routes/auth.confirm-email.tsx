import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { confirmSignupEmailFn } from "@/lib/auth/functions";
import { destinationAfterAuth, isPlainClient } from "@/lib/auth/return-path";
import { NOINDEX_NOFOLLOW } from "@/lib/seo/head";

const searchSchema = z.object({
  token: z.string().optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/confirm-email")({
  validateSearch: searchSchema,
  loader: ({ location }) => {
    const token = new URLSearchParams(location.searchStr).get("token") ?? "";
    return { token };
  },
  head: () => ({
    meta: [
      { title: "Подтверждение почты — Я ищу тренера на trenio.by" },
      NOINDEX_NOFOLLOW,
      { name: "description", content: "Подтвердите почту trenio.by." },
    ],
  }),
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  const { token } = Route.useLoaderData();
  const { next } = Route.useSearch();
  const router = useRouter();
  const confirm = useAuthServerFn(confirmSignupEmailFn);
  const { error, pending, run } = useAuthSubmit();
  const [done, setDone] = useState(false);

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">{token ? "Подтвердите почту" : "Ссылка недействительна"}</h1>
            <p className="auth-sub">
              {token
                ? "Нажмите кнопку, чтобы подтвердить адрес и войти."
                : "В ссылке нет токена. Запросите письмо ещё раз."}
            </p>
          </div>
          <AuthAlert message={error} />
          {token && !done ? (
            <button
              type="button"
              className="auth-submit"
              disabled={pending}
              onClick={() => {
                void run(
                  () => confirm({ data: { token } }),
                  async (result) => {
                    if (!result) return;
                    setDone(true);
                    const landed = "totpRequired" in result && result.totpRequired
                      ? "/auth/totp"
                      : "user" in result && isPlainClient(result.user.roles)
                        ? destinationAfterAuth(result.user.roles, next, false)
                        : result.redirectTo;
                    await router.invalidate();
                    if (landed) window.location.assign(landed);
                  },
                );
              }}
            >
              {pending ? "Проверка…" : "Подтвердить почту"}
            </button>
          ) : (
            <Link to="/auth/login" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
              Ко входу
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
