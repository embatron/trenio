import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { forgotPasswordFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Восстановление пароля — trenio.by" },
      {
        name: "description",
        content: "Сбросьте пароль от своего аккаунта trenio.by — мы отправим ссылку для восстановления на e-mail.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const forgotPassword = useAuthServerFn(forgotPasswordFn);
  const { error, pending, run } = useAuthSubmit();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          {!sent ? (
            <>
              <div className="auth-card__head">
                <h1 className="auth-title">Сбросить пароль</h1>
                <p className="auth-sub">
                  Введите e-mail, к которому привязан аккаунт. Мы пришлём ссылку для смены пароля.
                </p>
              </div>

              <AuthAlert message={error} />

              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => forgotPassword({ data: { email } }), () => setSent(true));
                }}
              >
                <label className="auth-field">
                  <span className="auth-field__label">E-mail</span>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button type="submit" className="auth-submit" disabled={pending}>
                  {pending ? "Отправка…" : "Отправить ссылку"}
                </button>
              </form>

              <p className="auth-foot">
                Вспомнили пароль? <Link to="/auth/login">Войти</Link>
              </p>
            </>
          ) : (
            <>
              <div className="auth-card__head">
                <div className="auth-success" aria-hidden>
                  ✓
                </div>
                <h1 className="auth-title">Проверьте почту</h1>
                <p className="auth-sub">
                  Если аккаунт с адресом <strong>{email}</strong> существует — мы отправили на него письмо
                  со ссылкой для сброса пароля. Ссылка действует 30 минут.
                </p>
              </div>
              <button type="button" className="auth-submit auth-submit--ghost" onClick={() => setSent(false)}>
                Отправить ещё раз
              </button>
              <p className="auth-foot">
                <Link to="/auth/login">Вернуться ко входу</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
