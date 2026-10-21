import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { honeypotFromForm, HoneypotField } from "@/components/auth/honeypot-field";
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
  confirmSmsLoginFn,
  loginFn,
  loginWithTelegramFn,
  loginWithTelegramWebAppFn,
  requestSmsLoginFn,
} from "@/lib/auth/functions";
import { BY_PHONE_COUNTRY_PREFIX, OTP_CODE_LENGTH } from "@/lib/auth/phone";
import { safeReturnPath } from "@/lib/auth/return-path";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context, search }) => {
    if (context.user) {
      const next = safeReturnPath(search.redirect);
      throw next ? redirect({ href: next }) : redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Вход — trenio.by" },
      {
        name: "description",
        content: "Войдите в trenio.by по e-mail, телефону или Telegram, чтобы искать тренировки и вести профиль.",
      },
    ],
  }),
  component: LoginPage,
});

type LoginMethod = "email" | "phone" | "telegram";

function LoginPage() {
  const [method, setMethod] = useState<LoginMethod>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(BY_PHONE_COUNTRY_PREFIX);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [devCode, setDevCode] = useState<string | null>(null);
  const countdown = useCountdown(0);
  const phoneFormRef = useRef<HTMLFormElement>(null);

  const login = useAuthServerFn(loginFn);
  const requestSms = useAuthServerFn(requestSmsLoginFn);
  const confirmSms = useAuthServerFn(confirmSmsLoginFn);
  const loginTelegram = useAuthServerFn(loginWithTelegramFn);
  const loginTelegramWebApp = useAuthServerFn(loginWithTelegramWebAppFn);
  const router = useRouter();
  const { redirect: returnPath } = Route.useSearch();
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  const goAfterLogin = async (result: { redirectTo?: string } | null) => {
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
            <h1 className="auth-title">С возвращением</h1>
            <p className="auth-sub">Войдите по почте, телефону или Telegram.</p>
          </div>

          <TelegramWebAppAuthButton
            onAuth={async (initData) => {
              setError(null);
              const result = await run(() => loginTelegramWebApp({ data: { initData } }));
              await goAfterLogin(result);
            }}
          />

          <div className="auth-roleswitch auth-roleswitch--3" role="tablist" aria-label="Способ входа">
            {(
              [
                ["email", "Почта"],
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
                    login({
                      data: {
                        email,
                        password,
                        remember: true,
                        honeypot: honeypotFromForm(event.currentTarget),
                      },
                    }),
                  goAfterLogin,
                );
              }}
            >
              <HoneypotField />
              <label className="auth-field">
                <span className="auth-field__label">E-mail</span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
              </label>
              <p className="auth-field__hint auth-field__hint--block">Сессия действует 3 недели.</p>
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Вход…" : "Войти"}
              </button>
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
                if (otp.replace(/\D/g, "").length !== OTP_CODE_LENGTH) {
                  setCodeError("Введите код из 6 цифр");
                  return;
                }
                setCodeError(undefined);
                void run(
                  () => confirmSms({ data: { phone, code: otp, honeypot: honeypotFromForm(form) } }),
                  goAfterLogin,
                );
              }}
            >
              <PhoneOtpFields
                idPrefix="login"
                phone={phone}
                onPhoneChange={setPhone}
                code={otp}
                onCodeChange={setOtp}
                phoneError={phoneError}
                codeError={codeError}
                sent={otpSent}
                secondsLeft={countdown.left}
                submitting={pending}
                onResend={() => {
                  if (phoneFormRef.current) void sendSms(phoneFormRef.current);
                }}
              />
            </form>
          ) : null}

          {method === "telegram" ? (
            <TelegramLoginButton
              onAuth={async (telegram: TelegramWidgetUser) => {
                setError(null);
                const result = await run(() => loginTelegram({ data: telegram }));
                await goAfterLogin(result);
              }}
            />
          ) : null}

          <p className="auth-foot">
            Ещё нет аккаунта? <Link to="/auth/signup">Зарегистрироваться</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
