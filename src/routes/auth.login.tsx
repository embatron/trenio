import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { loginFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/auth/login")({
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Вход — trenio.by" },
      {
        name: "description",
        content: "Войдите в аккаунт trenio.by, чтобы управлять профилем тренера или находить тренировки.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const login = useAuthServerFn(loginFn);
  const router = useRouter();
  const { error, pending, run, redirectTo } = useAuthSubmit();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">С возвращением</h1>
            <p className="auth-sub">Войдите, чтобы продолжить тренироваться или вести свой профиль.</p>
          </div>

          <AuthAlert message={error} />

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => login({ data: { email, password, remember } }),
                async (result) => {
                  if (result?.redirectTo) {
                    await router.invalidate();
                    redirectTo(result.redirectTo);
                  }
                },
              );
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
            <label className="auth-field">
              <span className="auth-field__label">
                Пароль
                <Link to="/auth/forgot-password" className="auth-field__hint">
                  Забыли пароль?
                </Link>
              </span>
              <div className="auth-field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>
            </label>

            <label className="auth-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Запомнить меня на этом устройстве</span>
            </label>

            <button type="submit" className="auth-submit" disabled={pending}>
              {pending ? "Вход…" : "Войти"}
            </button>
          </form>

          <p className="auth-foot">
            Ещё нет аккаунта? <Link to="/auth/signup">Зарегистрироваться</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
