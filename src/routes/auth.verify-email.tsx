import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { verifyEmailFn } from "@/lib/auth/functions";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const token = new URLSearchParams(location.searchStr).get("token") ?? undefined;
    if (!token) {
      return { status: "missing" as const, message: null };
    }
    try {
      const result = await verifyEmailFn({ data: { token } });
      return { status: "ok" as const, message: result.message };
    } catch {
      return { status: "error" as const, message: null };
    }
  },
  head: () => ({
    meta: [
      { title: "Подтверждение e-mail — trenio.by" },
      { name: "description", content: "Подтвердите e-mail для аккаунта trenio.by." },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { status, message } = Route.useLoaderData();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            {status === "missing" && (
              <>
                <h1 className="auth-title">Ссылка недействительна</h1>
                <p className="auth-sub">Проверьте письмо или запросите новую ссылку после входа.</p>
              </>
            )}
            {status === "ok" && (
              <>
                <div className="auth-success" aria-hidden>
                  ✓
                </div>
                <h1 className="auth-title">E-mail подтверждён</h1>
                <p className="auth-sub">{message}</p>
              </>
            )}
            {status === "error" && (
              <>
                <h1 className="auth-title">Не удалось подтвердить</h1>
                <p className="auth-sub">Ссылка устарела или уже использована.</p>
              </>
            )}
          </div>

          <Link
            to="/auth/login"
            className="auth-submit"
            style={{ display: "grid", placeItems: "center", textDecoration: "none" }}
          >
            Перейти ко входу
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
