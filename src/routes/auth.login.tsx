import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { honeypotFromForm, HoneypotField } from "@/components/auth/honeypot-field";
import {
  clientValidatePhone,
  PhoneOtpFields,
  useCountdown,
} from "@/components/auth/phone-otp-fields";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { YandexLoginButton } from "@/components/auth/yandex-login-button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import {
  confirmSmsLoginFn,
  loginFn,
  restoreAccountFn,
  requestSmsLoginFn,
} from "@/lib/auth/functions";
import { BY_PHONE_COUNTRY_PREFIX, OTP_CODE_LENGTH } from "@/lib/auth/phone";
import { destinationAfterAuth } from "@/lib/auth/return-path";
import type { UserRole } from "@/lib/auth/types";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; google?: string; yandex?: string; browse?: "1" } => {
    const redirect = typeof search.redirect === "string" ? search.redirect : undefined;
    const reason = (value: unknown) =>
      value === "failed" || value === "deleted" || value === "blocked" || value === "taken" ? value : undefined;
    const google = reason(search.google);
    const yandex = reason(search.yandex);
    const browse = search.browse === "1" ? "1" as const : undefined;
    return {
      ...(redirect ? { redirect } : {}),
      ...(google ? { google } : {}),
      ...(yandex ? { yandex } : {}),
      ...(browse ? { browse } : {}),
    };
  },
  beforeLoad: async ({ context, search }) => {
    if (context.user) {
      throw redirect({
        href: destinationAfterAuth(context.user.roles, search.redirect, search.browse === "1"),
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Вход — Я ищу тренера на trenio.by" },
      NOINDEX_FOLLOW,
      {
        name: "description",
        content: "Войдите в trenio.by по e-mail, Google, Яндексу или телефону, чтобы искать тренировки и вести профиль.",
      },
    ],
  }),
  component: LoginPage,
});

type LoginMethod = "email" | "phone";

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
  const [restoreOffer, setRestoreOffer] = useState(false);
  const countdown = useCountdown(0);
  const phoneFormRef = useRef<HTMLFormElement>(null);

  const login = useAuthServerFn(loginFn);
  const restoreAccount = useAuthServerFn(restoreAccountFn);
  const requestSms = useAuthServerFn(requestSmsLoginFn);
  const confirmSms = useAuthServerFn(confirmSmsLoginFn);
  const router = useRouter();
  const { redirect: returnPath, google, yandex, browse } = Route.useSearch();
  const providerNotice = (reason: string | undefined, name: "Google" | "Яндекс") =>
    reason === "deleted"
      ? "Этот аккаунт удалён. Войдите паролем и восстановите его."
      : reason === "blocked"
        ? "Аккаунт заблокирован. Обратитесь в поддержку."
        : reason === "taken"
          ? `Эта почта уже привязана к другому аккаунту ${name}.`
          : reason === "failed"
            ? `Не удалось войти через ${name}. Попробуйте ещё раз.`
            : null;
  const googleMessage = providerNotice(yandex, "Яндекс") ?? providerNotice(google, "Google");
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  const goAfterLogin = async (
    result: { redirectTo?: string; totpRequired?: boolean; user?: { roles: UserRole[] } } | null,
  ) => {
    if (result?.totpRequired) {
      await router.invalidate();
      redirectTo("/auth/totp");
      return;
    }
    if (!result) return;
    const next = destinationAfterAuth(result.user?.roles ?? [], returnPath, browse === "1");
    await router.invalidate();
    window.location.assign(next);
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
            <h1 className="auth-title">Войти на сайт</h1>
          </div>

          <div className="auth-roleswitch" role="tablist" aria-label="Способ входа">
            {(
              [
                ["email", "Email"],
                ["phone", "Телефон"],
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

          <div className="auth-google-slot">
            <GoogleLoginButton returnPath={returnPath} browse={browse === "1"} />
            <YandexLoginButton returnPath={returnPath} browse={browse === "1"} />
            <div className="auth-or" aria-hidden="true">или</div>
          </div>

          <AuthAlert message={error ?? googleMessage} />
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
                  async (result) => {
                    if (result && "restore" in result && result.restore) {
                      setRestoreOffer(true);
                      return;
                    }
                    setRestoreOffer(false);
                    await goAfterLogin(result && "redirectTo" in result ? result : null);
                  },
                );
              }}
            >
              <HoneypotField />
              <label className="auth-field">
                <span className="auth-field__label">Email</span>
                <input
                  type="text"
                  required
                  placeholder="you@example.com"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setRestoreOffer(false);
                  }}
                />
              </label>
              <label className="auth-field">
                <span className="auth-field__label">
                  <span>Пароль</span>
                  <Link to="/auth/forgot-password" className="auth-field__hint">
                    Забыли пароль?
                  </Link>
                </span>
                <div className="auth-field__input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Введите пароль"
                    maxLength={128}
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
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Вход…" : "Войти"}
              </button>
              {restoreOffer ? (
                <div className="auth-restore" role="status">
                  <p>
                    Этот аккаунт удалён. Данные хранятся шесть месяцев — его можно восстановить.
                  </p>
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
                        goAfterLogin,
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

          <p className="auth-foot">
            Ещё нет аккаунта?{" "}
            <Link
              to="/auth/signup"
              search={{
                ...(returnPath ? { redirect: returnPath } : {}),
                ...(browse ? { browse } : {}),
              }}
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
