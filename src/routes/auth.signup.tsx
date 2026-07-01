import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { PublicSignupRole } from "@/lib/auth/roles";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { signupFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/auth/signup")({
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Регистрация — trenio.by" },
      {
        name: "description",
        content: "Создайте аккаунт на trenio.by: ищите тренировки или принимайте заявки как тренер.",
      },
    ],
  }),
  component: SignupPage,
});

const SIGNUP_ROLES: Array<{
  value: PublicSignupRole;
  title: string;
  description: string;
}> = [
  { value: "user", title: "Я ищу тренера", description: "Записывайтесь на тренировки, сохраняйте избранное" },
  { value: "trainer", title: "Я тренер", description: "Создайте профиль и принимайте заявки" },
  { value: "club", title: "Я представляю клуб", description: "Добавьте филиал и команду тренеров" },
];

function SignupPage() {
  const [signupRole, setSignupRole] = useState<PublicSignupRole>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const signup = useAuthServerFn(signupFn);
  const { error, pending, run, redirectTo } = useAuthSubmit();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--wide">
          {success ? (
            <>
              <div className="auth-card__head">
                <div className="auth-success" aria-hidden>
                  ✓
                </div>
                <h1 className="auth-title">Аккаунт создан</h1>
                <p className="auth-sub">{success}</p>
              </div>
              <button type="button" className="auth-submit" onClick={() => redirectTo("/auth/login")}>
                Перейти ко входу
              </button>
            </>
          ) : (
            <>
              <div className="auth-card__head">
                <h1 className="auth-title">Создать аккаунт</h1>
                <p className="auth-sub">Это займёт меньше минуты. Подтверждение по e-mail.</p>
              </div>

              <div className="auth-roleswitch auth-roleswitch--3" role="tablist" aria-label="Тип аккаунта">
                {SIGNUP_ROLES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={signupRole === item.value}
                    className={`auth-role ${signupRole === item.value ? "is-active" : ""}`}
                    onClick={() => setSignupRole(item.value)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>

              <AuthAlert message={error} />

              <form
                className="auth-form auth-form--grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      signup({
                        data: {
                          email,
                          password,
                          firstName,
                          lastName: lastName || undefined,
                          phone: phone || undefined,
                          signupRole,
                        },
                      }),
                    (result) => {
                      if (result?.message) setSuccess(result.message);
                    },
                  );
                }}
              >
                <label className="auth-field">
                  <span className="auth-field__label">Имя</span>
                  <input
                    type="text"
                    required
                    placeholder="Как к вам обращаться"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </label>
                <label className="auth-field">
                  <span className="auth-field__label">Фамилия</span>
                  <input
                    type="text"
                    placeholder="Необязательно"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </label>
                <label className="auth-field auth-field--full">
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
                <label className="auth-field auth-field--full">
                  <span className="auth-field__label">Телефон</span>
                  <input
                    type="tel"
                    placeholder="+375 (29) 000-00-00"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="auth-field auth-field--full">
                  <span className="auth-field__label">Пароль</span>
                  <div className="auth-field__input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Минимум 8 символов"
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
                    Хотя бы 8 символов, включая цифру и заглавную букву.
                  </span>
                </label>

                <label className="auth-check auth-field--full">
                  <input type="checkbox" required />
                  <span>
                    Принимаю <Link to="/privacy">политику конфиденциальности</Link>
                  </span>
                </label>

                <button type="submit" className="auth-submit auth-field--full" disabled={pending}>
                  {pending
                    ? "Создание…"
                    : signupRole === "trainer"
                      ? "Создать профиль тренера"
                      : signupRole === "club"
                        ? "Зарегистрировать клуб"
                        : "Зарегистрироваться"}
                </button>
              </form>

              <p className="auth-foot">
                Уже есть аккаунт? <Link to="/auth/login">Войти</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
