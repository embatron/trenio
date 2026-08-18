import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { setPasswordFn } from "@/lib/auth/functions";
import { validatePasswordStrength } from "@/lib/auth/password-policy";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/auth/set-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Задайте пароль — trenio.by" },
      { name: "description", content: "Задайте пароль для аккаунта trenio.by по ссылке из письма." },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const setPasswordSubmit = useAuthServerFn(setPasswordFn);
  const router = useRouter();
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  if (!token) {
    return (
      <div className="auth-page">
        <AuthStyles />
        <SiteHeader />
        <main className="auth-main">
          <div className="auth-card">
            <div className="auth-card__head">
              <h1 className="auth-title">Ссылка недействительна</h1>
              <p className="auth-sub">Запросите письмо ещё раз на странице регистрации.</p>
            </div>
            <Link
              to="/auth/signup"
              className="auth-submit"
              style={{ display: "grid", placeItems: "center", textDecoration: "none" }}
            >
              К регистрации
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">Задайте пароль</h1>
            <p className="auth-sub">
              Переход по ссылке подтверждает e-mail. После сохранения пароля откроется кабинет — там можно подтвердить
              телефон.
            </p>
          </div>

          <AuthAlert message={error} />

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== confirm) {
                setError("Пароли не совпадают");
                return;
              }
              const policyError = validatePasswordStrength(password);
              if (policyError) {
                setError(policyError);
                return;
              }
              void run(
                () => setPasswordSubmit({ data: { token, password } }),
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
              <span className="auth-field__label">Пароль</span>
              <div className="auth-field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              <span className="auth-field__hint auth-field__hint--block">
                Минимум 8 символов, цифра и заглавная буква.
              </span>
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Повторите пароль</span>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <button type="submit" className="auth-submit" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить пароль"}
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
