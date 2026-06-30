import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { AuthStyles } from "@/components/auth-styles";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Вход — trenio.by" },
      { name: "description", content: "Войдите в аккаунт trenio.by, чтобы управлять профилем тренера или находить тренировки." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
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

          <div className="auth-social">
            <button type="button" className="auth-social__btn">
              <span className="auth-social__icon" aria-hidden>G</span>
              Войти через Google
            </button>
            <button type="button" className="auth-social__btn">
              <span className="auth-social__icon" aria-hidden></span>
              Войти через Apple
            </button>
          </div>

          <div className="auth-divider"><span>или по e-mail</span></div>

          <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
            <label className="auth-field">
              <span className="auth-field__label">E-mail</span>
              <input type="email" required placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">
                Пароль
                <Link to="/auth/forgot-password" className="auth-field__hint">Забыли пароль?</Link>
              </span>
              <div className="auth-field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                />
                <button type="button" className="auth-field__toggle" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>
            </label>

            <label className="auth-check">
              <input type="checkbox" defaultChecked />
              <span>Запомнить меня на этом устройстве</span>
            </label>

            <button type="submit" className="auth-submit">Войти</button>
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
