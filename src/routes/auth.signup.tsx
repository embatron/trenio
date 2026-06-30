import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { AuthStyles } from "@/components/auth-styles";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Регистрация — trenio.by" },
      { name: "description", content: "Создайте аккаунт на trenio.by: ищите тренировки или принимайте заявки как тренер." },
    ],
  }),
  component: SignupPage,
});

type Role = "client" | "trainer";

function SignupPage() {
  const [role, setRole] = useState<Role>("client");
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--wide">
          <div className="auth-card__head">
            <h1 className="auth-title">Создать аккаунт</h1>
            <p className="auth-sub">Это займёт меньше минуты. Подтверждение по e-mail.</p>
          </div>

          <div className="auth-roleswitch" role="tablist" aria-label="Тип аккаунта">
            <button
              type="button"
              role="tab"
              aria-selected={role === "client"}
              className={`auth-role ${role === "client" ? "is-active" : ""}`}
              onClick={() => setRole("client")}
            >
              <strong>Я ищу тренера</strong>
              <span>Записывайтесь на тренировки, сохраняйте избранное</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "trainer"}
              className={`auth-role ${role === "trainer" ? "is-active" : ""}`}
              onClick={() => setRole("trainer")}
            >
              <strong>Я тренер</strong>
              <span>Создайте профиль, принимайте заявки и отзывы</span>
            </button>
          </div>

          <div className="auth-social">
            <button type="button" className="auth-social__btn">
              <span className="auth-social__icon" aria-hidden>G</span>
              Продолжить с Google
            </button>
            <button type="button" className="auth-social__btn">
              <span className="auth-social__icon" aria-hidden></span>
              Продолжить с Apple
            </button>
          </div>

          <div className="auth-divider"><span>или заполните форму</span></div>

          <form className="auth-form auth-form--grid" onSubmit={(e) => e.preventDefault()}>
            <label className="auth-field">
              <span className="auth-field__label">Имя</span>
              <input type="text" required placeholder="Как к вам обращаться" autoComplete="given-name" />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Фамилия</span>
              <input type="text" placeholder="Необязательно" autoComplete="family-name" />
            </label>
            <label className="auth-field auth-field--full">
              <span className="auth-field__label">E-mail</span>
              <input type="email" required placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="auth-field auth-field--full">
              <span className="auth-field__label">Телефон</span>
              <input type="tel" placeholder="+375 (29) 000-00-00" autoComplete="tel" />
            </label>
            {role === "trainer" && (
              <label className="auth-field auth-field--full">
                <span className="auth-field__label">Основной вид спорта</span>
                <input type="text" placeholder="Бокс, йога, плавание…" />
              </label>
            )}
            <label className="auth-field auth-field--full">
              <span className="auth-field__label">Пароль</span>
              <div className="auth-field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Минимум 8 символов"
                  autoComplete="new-password"
                />
                <button type="button" className="auth-field__toggle" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>
              <span className="auth-field__hint auth-field__hint--block">
                Хотя бы 8 символов, включая цифру и заглавную букву.
              </span>
            </label>

            <label className="auth-check auth-field--full">
              <input type="checkbox" required />
              <span>
                Принимаю <a href="#">условия использования</a> и <a href="#">политику конфиденциальности</a>
              </span>
            </label>

            <button type="submit" className="auth-submit auth-field--full">
              {role === "trainer" ? "Создать профиль тренера" : "Зарегистрироваться"}
            </button>
          </form>

          <p className="auth-foot">
            Уже есть аккаунт? <Link to="/auth/login">Войти</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
