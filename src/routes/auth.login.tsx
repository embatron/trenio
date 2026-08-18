import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { confirmSmsLoginFn, loginFn, requestSmsLoginFn } from "@/lib/auth/functions";
import {
  BY_PHONE_COUNTRY_PREFIX,
  OTP_CODE_LENGTH,
  constrainBelarusPhoneInput,
  validateBelarusMobile,
} from "@/lib/auth/phone";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
        content: "Войдите в аккаунт trenio.by по e-mail или по SMS на мобильный номер РБ.",
      },
    ],
  }),
  component: LoginPage,
});

function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    setLeft(initial);
  }, [initial]);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return { left, restart: (seconds: number) => setLeft(seconds) };
}

function LoginPage() {
  const [method, setMethod] = useState<"password" | "sms">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [phone, setPhone] = useState(BY_PHONE_COUNTRY_PREFIX);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const countdown = useCountdown(0);

  const login = useAuthServerFn(loginFn);
  const requestSms = useAuthServerFn(requestSmsLoginFn);
  const confirmSms = useAuthServerFn(confirmSmsLoginFn);
  const router = useRouter();
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-title">С возвращением</h1>
            <p className="auth-sub">Войдите по e-mail и паролю или по SMS на подтверждённый мобильный номер РБ.</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Способ входа">
            <button
              type="button"
              role="tab"
              aria-selected={method === "password"}
              className={`auth-tab ${method === "password" ? "is-active" : ""}`}
              onClick={() => setMethod("password")}
            >
              E-mail
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === "sms"}
              className={`auth-tab ${method === "sms" ? "is-active" : ""}`}
              onClick={() => setMethod("sms")}
            >
              SMS
            </button>
          </div>

          <AuthAlert message={error} />

          {method === "password" ? (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                const company_url = honeypotFromForm(e.currentTarget);
                void run(
                  () => login({ data: { email, password, remember, company_url } }),
                  async (result) => {
                    if (result?.redirectTo) {
                      await router.invalidate();
                      redirectTo(result.redirectTo);
                    }
                  },
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
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const company_url = honeypotFromForm(form);
                if (!otpSent) {
                  const phoneError = validateBelarusMobile(phone);
                  if (phoneError) {
                    setError(phoneError);
                    return;
                  }
                  void run(
                    () => requestSms({ data: { phone, company_url } }),
                    (result) => {
                      setOtpSent(true);
                      countdown.restart(result.retryAfterSec);
                      setDevCode(result.devCode ?? null);
                    },
                  );
                  return;
                }
                if (otp.replace(/\D/g, "").length !== OTP_CODE_LENGTH) {
                  setError("Введите код из 6 цифр");
                  return;
                }
                void run(
                  () => confirmSms({ data: { phone, code: otp, remember, company_url } }),
                  async (result) => {
                    if (result?.redirectTo) {
                      await router.invalidate();
                      redirectTo(result.redirectTo);
                    }
                  },
                );
              }}
            >
              <HoneypotField />
              <label className="auth-field">
                <span className="auth-field__label">Телефон</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={constrainBelarusPhoneInput(phone)}
                  onChange={(e) => setPhone(constrainBelarusPhoneInput(e.target.value))}
                />
                <span className="auth-field__hint auth-field__hint--block">
                  Мобильный номер РБ. Код действует 10 минут, повтор — через 1 минуту.
                </span>
              </label>
              {otpSent ? (
                <div className="auth-field">
                  <span className="auth-field__label">Код из SMS</span>
                  <div className="auth-otp">
                    <InputOTP maxLength={OTP_CODE_LENGTH} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
                          <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {countdown.left > 0 ? (
                    <span className="auth-field__hint auth-field__hint--block">
                      Повторная отправка через {countdown.left} с.
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="auth-field__hint"
                      disabled={pending}
                      onClick={() => {
                        void run(
                          () => requestSms({ data: { phone, company_url: "" } }),
                          (result) => {
                            countdown.restart(result.retryAfterSec);
                            setDevCode(result.devCode ?? null);
                          },
                        );
                      }}
                    >
                      Отправить код снова
                    </button>
                  )}
                </div>
              ) : null}
              {devCode ? <p className="auth-dev">Dev-код: {devCode}</p> : null}
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Запомнить меня на этом устройстве</span>
              </label>
              <button
                type="submit"
                className="auth-submit"
                disabled={pending || (otpSent && otp.replace(/\D/g, "").length !== OTP_CODE_LENGTH)}
              >
                {pending ? (otpSent ? "Проверка…" : "Отправка…") : otpSent ? "Войти" : "Получить код"}
              </button>
            </form>
          )}

          <p className="auth-foot">
            Ещё нет аккаунта? <Link to="/auth/signup">Зарегистрироваться</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
