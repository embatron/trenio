import { createFileRoute, Link, redirect, useRouteContext, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { CabinetNotice } from "@/components/cabinet";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthServerFn, useAuthSubmit } from "@/lib/auth/use-auth-form";
import { hasAnyRole, isStaff } from "@/lib/auth/roles";
import { isStandInAccountName } from "@/lib/auth/phone-label";
import { becomeTrainerFn, signupTrainerAccountFn } from "@/lib/catalog/trainer-account.functions";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/join/account")({
  beforeLoad: ({ context }) => {
    const user = context.user;
    if (!user) return;
    if (isStaff(user.roles)) throw redirect({ to: "/admin" });
    if (hasAnyRole(user.roles, ["trainer"])) throw redirect({ to: "/me/profile" });
    if (hasAnyRole(user.roles, ["club"])) throw redirect({ to: "/me" });
  },
  head: () => ({
    meta: [
      { title: "Создать профиль тренера — Я ищу тренера на trenio.by" },
      NOINDEX_FOLLOW,
      { name: "description", content: "Профиль тренера без Instagram: имя, почта и пароль. Подтверждение приходит на почту." },
    ],
  }),
  component: TrainerAccountPage,
});

function TrainerAccountPage() {
  const { user } = useRouteContext({ from: "__root__" });
  return (
    <div className="auth-page join-account">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <nav className="join-account__crumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span aria-hidden="true">/</span>
            <Link to="/join/trainer">Тренерам</Link>
            <span aria-hidden="true">/</span>
            <span className="is-current" aria-current="page">Профиль</span>
          </nav>
          <div className="auth-card__head">
            <h1 className="auth-title">Создать профиль тренера (без Instagram)</h1>
            <p className="auth-sub">
              Имя, почта и пароль. Фамилия необязательна. Карточка останется черновиком, пока ты сам её не опубликуешь.
            </p>
          </div>
          {user ? <UpgradeForm firstName={user.firstName} lastName={user.lastName ?? ""} /> : <SignupForm />}
        </div>
      </main>
      <SiteFooter />
      <style>{`
        .join-account__crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 16px; color: var(--muted); font-size: 14px; }
        .join-account__crumbs a { color: var(--muted); text-decoration: none; }
        .join-account__crumbs a:hover { color: var(--primary); }
        .join-account .auth-check { align-items: center; min-height: 44px; }
        .join-account .auth-check input { width: 22px; height: 22px; margin-top: 0; flex: 0 0 auto; }
        .join-account .auth-foot { margin-top: 4px; }
        .join-account a.auth-login {
          display: grid; place-items: center; width: 100%; min-height: 50px; margin-top: 4px;
          border-radius: var(--radius-control); border: 1px solid rgba(var(--primary-rgb), 0.3);
          background: transparent; color: var(--primary); font-size: 15px; font-weight: var(--fw-title);
          letter-spacing: -0.01em; text-decoration: none;
        }
        .join-account a.auth-login:hover { background: rgba(var(--primary-rgb), 0.06); }
        .join-account .cabinet-modal { position: fixed; inset: 0; z-index: 420; display: grid; place-items: center; overflow: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
        .join-account .cabinet-modal__card { width: min(440px, 100%); display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); }
        .join-account .cabinet-modal__card h2 { margin: 0; font-size: 18px; color: var(--dark); }
        .join-account .cabinet-modal__card p { margin: 0; color: var(--text); line-height: 1.45; }
        .join-account .cabinet-modal__card button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
        @media (max-width: 767px) {
          .join-account__crumbs { font-size: 12px; gap: 6px; }
        }
      `}</style>
    </div>
  );
}

function SignupForm() {
  const signup = useAuthServerFn(signupTrainerAccountFn);
  const { error, pending, run, setError } = useAuthSubmit();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [popup, setPopup] = useState(false);

  return (
    <>
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (password !== passwordConfirm) {
          setError("Пароли не совпадают.");
          return;
        }
        if (!privacy) {
          setError("Примите политику конфиденциальности.");
          return;
        }
        void run(
          () => signup({
            data: {
              firstName,
              lastName,
              email,
              password,
              passwordConfirm,
              privacy: true,
              honeypot: honeypotFromForm(event.currentTarget),
            },
          }),
          (result) => {
            if (result && "message" in result) {
              setNotice("Мы отправили письмо со ссылкой. Откройте его и подтвердите создание аккаунта. После этого откроется кабинет, где можно заполнить профиль.");
              setPopup(true);
            }
          },
        );
      }}
    >
      <HoneypotField />
      <AuthAlert message={error} />
      {notice ? <p className="auth-alert auth-alert--note">{notice}</p> : null}
      {notice ? null : (
        <>
          <NameFields
            firstName={firstName}
            lastName={lastName}
            onFirst={setFirstName}
            onLast={setLastName}
          />
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <PasswordFields
            password={password}
            passwordConfirm={passwordConfirm}
            show={showPassword}
            onPassword={setPassword}
            onConfirm={setPasswordConfirm}
            onToggle={() => setShowPassword((value) => !value)}
          />
          <PrivacyConsent privacy={privacy} onPrivacy={setPrivacy} />
          <button type="submit" className="auth-submit" disabled={pending}>
            {pending ? "Создание…" : "Создать аккаунт"}
          </button>
        </>
      )}
    </form>
    {popup && notice ? (
      <CabinetNotice
        title="Проверьте почту"
        message={notice}
        onClose={() => setPopup(false)}
      />
    ) : null}
    <Link to="/auth/login" search={{ redirect: "/join/account" }} className="auth-login">
      У меня уже есть аккаунт
    </Link>
    </>
  );
}

function UpgradeForm({ firstName: initialFirst, lastName: initialLast }: { firstName: string; lastName: string }) {
  const become = useAuthServerFn(becomeTrainerFn);
  const router = useRouter();
  const { error, pending, run, redirectTo } = useAuthSubmit();
  const [firstName, setFirstName] = useState(isStandInAccountName(initialFirst) ? "" : initialFirst);
  const [lastName, setLastName] = useState(initialLast);

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          () => become({ data: { firstName, lastName } }),
          async (result) => {
            if (!result || !("redirectTo" in result)) return;
            await router.invalidate();
            redirectTo(result.redirectTo);
          },
        );
      }}
    >
      <AuthAlert message={error} />
      <p className="auth-sub">Этот аккаунт станет кабинетом тренера. Instagram не нужен.</p>
      <NameFields firstName={firstName} lastName={lastName} onFirst={setFirstName} onLast={setLastName} />
      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? "Открываем…" : "Открыть кабинет тренера"}
      </button>
    </form>
  );
}

function NameFields({
  firstName,
  lastName,
  onFirst,
  onLast,
}: {
  firstName: string;
  lastName: string;
  onFirst: (value: string) => void;
  onLast: (value: string) => void;
}) {
  return (
    <>
      <label className="auth-field">
        <span className="auth-field__label">Имя</span>
        <input type="text" required autoComplete="given-name" value={firstName} onChange={(event) => onFirst(event.target.value)} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">Фамилия, необязательно</span>
        <input type="text" autoComplete="family-name" value={lastName} onChange={(event) => onLast(event.target.value)} />
      </label>
    </>
  );
}

function PasswordFields({
  password,
  passwordConfirm,
  show,
  onPassword,
  onConfirm,
  onToggle,
}: {
  password: string;
  passwordConfirm: string;
  show: boolean;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onToggle: () => void;
}) {
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  return (
    <>
      <label className="auth-field">
        <span className="auth-field__label">Пароль</span>
        <div className="auth-field__input-wrap">
          <input
            type={show ? "text" : "password"}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
          />
          <button type="button" className="auth-field__toggle" onClick={onToggle}>
            {show ? "Скрыть" : "Показать"}
          </button>
        </div>
        <PasswordStrength password={password} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">Пароль ещё раз</span>
        <input
          type={show ? "text" : "password"}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={mismatch}
          value={passwordConfirm}
          onChange={(event) => onConfirm(event.target.value)}
        />
        {mismatch ? <span className="auth-field__hint auth-field__hint--block">Пароли пока не совпадают.</span> : null}
      </label>
    </>
  );
}

function PrivacyConsent({ privacy, onPrivacy }: { privacy: boolean; onPrivacy: (value: boolean) => void }) {
  return (
    <label className="auth-check">
      <input type="checkbox" required checked={privacy} onChange={(event) => onPrivacy(event.target.checked)} />
      <span>Согласен на обработку данных по <Link to="/privacy">политике конфиденциальности</Link></span>
    </label>
  );
}
