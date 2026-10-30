import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { PublicSignupRole } from "@/lib/auth/roles";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { signupFn } from "@/lib/auth/functions";
import { TRAINER_INVITE_LINE } from "@/lib/catalog/trainer-welcome";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/signup")({
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Регистрация — trenio.by" },
      NOINDEX_FOLLOW,
      {
        name: "description",
        content: "Создайте аккаунт на trenio.by: укажите имя и e-mail — пароль зададите по ссылке из письма.",
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
  { value: "user", title: "Я ищу тренера", description: "Сохраняйте избранное и открывайте контакты" },
  { value: "trainer", title: "Я тренер", description: TRAINER_INVITE_LINE },
  { value: "club", title: "Я представляю клуб", description: "Добавьте филиал и команду тренеров" },
];

function SignupPage() {
  const [signupRole, setSignupRole] = useState<PublicSignupRole>("user");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const signup = useAuthServerFn(signupFn);
  const { error, pending, run } = useAuthSubmit();

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
                <h1 className="auth-title">Проверьте почту</h1>
                <p className="auth-sub">{success}</p>
              </div>
              {devUrl ? (
                <p className="auth-dev">
                  Dev-ссылка: <a href={devUrl}>{devUrl}</a>
                </p>
              ) : null}
              <Link
                to="/auth/login"
                className="auth-submit"
                style={{ display: "grid", placeItems: "center", textDecoration: "none" }}
              >
                Перейти ко входу
              </Link>
            </>
          ) : (
            <>
              <div className="auth-card__head">
                <h1 className="auth-title">Создать аккаунт</h1>
                <p className="auth-sub">
                  Укажите имя, фамилию и e-mail. Пароль зададите по ссылке из письма — так мы подтверждаем адрес.
                </p>
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
                  const company_url = honeypotFromForm(e.currentTarget);
                  void run(
                    () =>
                      signup({
                        data: {
                          email,
                          firstName,
                          lastName,
                          signupRole,
                          company_url,
                        },
                      }),
                    (result) => {
                      if (result?.message) setSuccess(result.message);
                      if (result?.devUrl) setDevUrl(result.devUrl);
                    },
                  );
                }}
              >
                <HoneypotField />
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
                    required
                    placeholder="Фамилия"
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

                <label className="auth-check auth-field--full">
                  <input type="checkbox" required />
                  <span>
                    Принимаю <Link to="/privacy">политику конфиденциальности</Link>
                  </span>
                </label>

                <button type="submit" className="auth-submit auth-field--full" disabled={pending}>
                  {pending
                    ? "Отправка…"
                    : signupRole === "trainer"
                      ? "Создать аккаунт"
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
