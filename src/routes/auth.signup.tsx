import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { honeypotFromForm, HoneypotField } from "@/components/auth/honeypot-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  clientValidatePhone,
  PhoneOtpFields,
  useCountdown,
} from "@/components/auth/phone-otp-fields";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { TelegramWebAppAuthButton } from "@/components/auth/telegram-webapp-auth-button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import {
  confirmSmsSignupFn,
  requestSmsSignupFn,
  restoreAccountFn,
  signupFn,
  signupWithTelegramFn,
  signupWithTelegramWebAppFn,
} from "@/lib/auth/functions";
import { BY_PHONE_COUNTRY_PREFIX, OTP_CODE_LENGTH } from "@/lib/auth/phone";
import { getPostLoginPath } from "@/lib/auth/roles";
import { safeReturnPath } from "@/lib/auth/return-path";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";

export const Route = createFileRoute("/auth/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context }) => {
    if (!context.user) return;
    if (context.user.needsCredentials) {
      throw redirect({ href: getPostLoginPath(context.user.roles) });
    }
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Регистрация — trenio.by" },
      NOINDEX_FOLLOW,
      {
        name: "description",
        content: "Создайте аккаунт trenio.by по почте, телефону или Telegram.",
      },
    ],
  }),
  component: SignupPage,
});

type SignupMethod = "email" | "phone" | "telegram";

function SignupPage() {
  const [method, setMethod] = useState<SignupMethod>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [phone, setPhone] = useState(BY_PHONE_COUNTRY_PREFIX);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [devCode, setDevCode] = useState<string | null>(null);
  const [restoreOffer, setRestoreOffer] = useState(false);
  const countdown = useCountdown(0);
  const phoneFormRef = useRef<HTMLFormElement>(null);

  const signup = useAuthServerFn(signupFn);
  const restoreAccount = useAuthServerFn(restoreAccountFn);
  const requestSms = useAuthServerFn(requestSmsSignupFn);
  const confirmSms = useAuthServerFn(confirmSmsSignupFn);
  const signupTelegram = useAuthServerFn(signupWithTelegramFn);
  const signupTelegramWebApp = useAuthServerFn(signupWithTelegramWebAppFn);
  const router = useRouter();
  const { redirect: returnPath } = Route.useSearch();
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  const goAfterSignup = async (
    result: { redirectTo?: string; user?: { needsCredentials?: boolean } } | null,
  ) => {
    if (result?.user?.needsCredentials) {
      await router.invalidate();
      redirectTo(result.redirectTo ?? "/account/reviews");
      return;
    }
    const next = safeReturnPath(returnPath) ?? result?.redirectTo;
    if (!next) return;
    await router.invalidate();
    if (safeReturnPath(returnPath)) {
      window.location.assign(next);
      return;
    }
    redirectTo(next);
  };

  const sendSms = async (form: HTMLFormElement) => {
    if (!accepted) {
      setError("Примите политику конфиденциальности.");
      return;
    }
    const invalid = clientValidatePhone(phone);
    if (invalid) {
      setPhoneError(invalid);
      return;
    }
    setPhoneError(undefined);
    setCodeError(undefined);
    setDevCode(null);
    const result = await run(() => requestSms({ data: { phone, honeypot: honeypotFromForm(form) } }));
    if (!result) return;
    setOtpSent(true);
    countdown.restart(result.retryAfterSec);
    setDevCode(result.devCode ?? null);
  };

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">Создать аккаунт</h1>
          </div>

          <div className="auth-webapp-slot">
            <TelegramWebAppAuthButton
              onAuth={async (initData) => {
                if (!accepted) {
                  setError("Примите политику конфиденциальности.");
                  return;
                }
                setError(null);
                const result = await run(() => signupTelegramWebApp({ data: { initData } }));
                await goAfterSignup(result);
              }}
            />
          </div>

          <div className="auth-roleswitch auth-roleswitch--3" role="tablist" aria-label="Способ регистрации">
            {(
              [
                ["email", "Email"],
                ["phone", "Телефон"],
                ["telegram", "Telegram"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={method === value}
                className={`auth-role auth-role--compact${method === value ? " is-active" : ""}`}
                onClick={() => {
                  setMethod(value);
                  setError(null);
                  setRestoreOffer(false);
                }}
              >
                <strong>{label}</strong>
              </button>
            ))}
          </div>

          <AuthAlert message={error} />
          {devCode && method === "phone" ? (
            <div className="auth-alert auth-alert--note" style={{ marginBottom: 16 }}>
              Dev-код: {devCode}
            </div>
          ) : null}

          {method === "email" ? (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () =>
                    signup({
                      data: {
                        email,
                        password,
                        honeypot: honeypotFromForm(event.currentTarget),
                      },
                    }),
                  async (result) => {
                    if (result && "restore" in result && result.restore) {
                      setRestoreOffer(true);
                      return;
                    }
                    setRestoreOffer(false);
                    await goAfterSignup(result);
                  },
                );
              }}
            >
              <HoneypotField />
              <label className="auth-field">
                <span className="auth-field__label">Email</span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setRestoreOffer(false);
                  }}
                />
              </label>
              <label className="auth-field">
                <span className="auth-field__label">Пароль</span>
                <div className="auth-field__input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Минимум 8 символов"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-field__toggle"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </label>
              <PrivacyCheck accepted={accepted} onChange={setAccepted} />
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Создание…" : "Зарегистрироваться"}
              </button>
              <div className="auth-or" aria-hidden="true">или</div>
              <GoogleLoginButton returnPath={returnPath} disabled={!accepted} />
              {restoreOffer ? (
                <div className="auth-restore" role="status">
                  <p>Этот аккаунт удалён. Данные хранятся шесть месяцев — его можно восстановить.</p>
                  <button
                    type="button"
                    className="auth-submit"
                    disabled={pending}
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      void run(
                        () =>
                          restoreAccount({
                            data: {
                              email,
                              password,
                              remember: true,
                              honeypot: form ? honeypotFromForm(form) : "",
                            },
                          }),
                        goAfterSignup,
                      );
                    }}
                  >
                    {pending ? "Восстановление…" : "Восстановить аккаунт"}
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {method === "phone" ? (
            <form
              ref={phoneFormRef}
              className="auth-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                if (!otpSent) {
                  void sendSms(form);
                  return;
                }
                if (!accepted) {
                  setError("Примите политику конфиденциальности.");
                  return;
                }
                if (otp.replace(/\D/g, "").length !== OTP_CODE_LENGTH) {
                  setCodeError("Введите код из 6 цифр");
                  return;
                }
                setCodeError(undefined);
                void run(
                  () => confirmSms({ data: { phone, code: otp, honeypot: honeypotFromForm(form) } }),
                  goAfterSignup,
                );
              }}
            >
              <PhoneOtpFields
                idPrefix="signup"
                phone={phone}
                onPhoneChange={setPhone}
                code={otp}
                onCodeChange={setOtp}
                phoneError={phoneError}
                codeError={codeError}
                sent={otpSent}
                secondsLeft={countdown.left}
                submitting={pending}
                confirmLabel="Зарегистрироваться"
                onResend={() => {
                  if (phoneFormRef.current) void sendSms(phoneFormRef.current);
                }}
              >
                <PrivacyCheck accepted={accepted} onChange={setAccepted} />
              </PhoneOtpFields>
            </form>
          ) : null}

          {method === "telegram" ? (
            <div className="auth-form">
              <p className="auth-muted">
                Если этот Telegram уже привязан, откроется тот же аккаунт. Второй аккаунт не создаётся.
              </p>
              <PrivacyCheck accepted={accepted} onChange={setAccepted} />
              <TelegramLoginButton
                missing="Регистрация через Telegram сейчас недоступна. Выберите почту или телефон."
                onAuth={async (telegram: TelegramWidgetUser) => {
                  if (!accepted) {
                    setError("Примите политику конфиденциальности.");
                    return;
                  }
                  setError(null);
                  const result = await run(() => signupTelegram({ data: telegram }));
                  await goAfterSignup(result);
                }}
              />
            </div>
          ) : null}

          <p className="auth-foot">
            Уже есть аккаунт? <Link to="/auth/login">Войти</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function PrivacyCheck({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="auth-check">
      <input
        type="checkbox"
        required
        checked={accepted}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Принимаю <Link to="/privacy">политику конфиденциальности</Link>
      </span>
    </label>
  );
}
