import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  confirmPhoneVerifyFn,
  logoutFn,
  requestEmailChangeFn,
  requestPhoneVerifyFn,
  updateNameFn,
} from "@/lib/auth/functions";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import {
  BY_PHONE_COUNTRY_PREFIX,
  OTP_CODE_LENGTH,
  constrainBelarusPhoneInput,
  maskBelarusMobile,
  validateBelarusMobile,
} from "@/lib/auth/phone";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/auth/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Кабинет — trenio.by" },
      { name: "description", content: "Личные данные аккаунта trenio.by: имя, e-mail и телефон." },
    ],
  }),
  component: AccountPage,
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

function AccountPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ? constrainBelarusPhoneInput(user.phone) : BY_PHONE_COUNTRY_PREFIX);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const countdown = useCountdown(0);

  const updateName = useAuthServerFn(updateNameFn);
  const changeEmail = useAuthServerFn(requestEmailChangeFn);
  const requestPhone = useAuthServerFn(requestPhoneVerifyFn);
  const confirmPhone = useAuthServerFn(confirmPhoneVerifyFn);
  const logout = useAuthServerFn(logoutFn);
  const { error, pending, run, setError } = useAuthSubmit();

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--wide">
          <div className="auth-card__head">
            <h1 className="auth-title">Личные данные</h1>
            <p className="auth-sub">Имя, e-mail и мобильный номер для входа по SMS.</p>
          </div>

          <AuthAlert message={error} />
          {notice ? <p className="auth-dev">{notice}</p> : null}

          <form
            className="auth-form auth-form--grid"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              void run(
                () => updateName({ data: { firstName, lastName: lastName || undefined } }),
                async () => {
                  setNotice("Имя сохранено.");
                  await router.invalidate();
                },
              );
            }}
          >
            <label className="auth-field">
              <span className="auth-field__label">Имя</span>
              <input type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Фамилия</span>
              <input type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <button type="submit" className="auth-submit auth-field--full" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить имя"}
            </button>
          </form>

          <form
            className="auth-form"
            style={{ marginTop: 28 }}
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              void run(
                () => changeEmail({ data: { email } }),
                (result) => {
                  if (result?.message) setNotice(result.message);
                  if (result?.devUrl) setNotice(`${result.message} ${result.devUrl}`);
                },
              );
            }}
          >
            <label className="auth-field">
              <span className="auth-field__label">E-mail</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="auth-field__hint auth-field__hint--block">
                Текущий адрес: {user?.email}. Новый запишется только после перехода по ссылке из письма.
              </span>
            </label>
            <button type="submit" className="auth-submit" disabled={pending}>
              {pending ? "Отправка…" : "Отправить ссылку на новый адрес"}
            </button>
          </form>

          <form
            className="auth-form"
            style={{ marginTop: 28 }}
            onSubmit={(e) => {
              e.preventDefault();
              const company_url = honeypotFromForm(e.currentTarget);
              setNotice(null);
              if (!otpSent) {
                const phoneError = validateBelarusMobile(phone);
                if (phoneError) {
                  setError(phoneError);
                  return;
                }
                void run(
                  () => requestPhone({ data: { phone, company_url } }),
                  (result) => {
                    setOtpSent(true);
                    countdown.restart(result.retryAfterSec);
                    setDevCode(result.devCode ?? null);
                    if (result.message) setNotice(result.message);
                  },
                );
                return;
              }
              if (otp.replace(/\D/g, "").length !== OTP_CODE_LENGTH) {
                setError("Введите код из 6 цифр");
                return;
              }
              void run(
                () => confirmPhone({ data: { phone, code: otp, company_url } }),
                async () => {
                  setNotice("Телефон подтверждён.");
                  setOtpSent(false);
                  setOtp("");
                  await router.invalidate();
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
                {user?.phoneVerified && user.phone
                  ? `Подтверждён: ${maskBelarusMobile(user.phone)}`
                  : "Номер появится в аккаунте только после кода из SMS."}
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
                  <span className="auth-field__hint auth-field__hint--block">Повтор через {countdown.left} с.</span>
                ) : (
                  <button
                    type="button"
                    className="auth-field__hint"
                    disabled={pending}
                    onClick={() => {
                      void run(
                        () => requestPhone({ data: { phone, company_url: "" } }),
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
            <button type="submit" className="auth-submit" disabled={pending}>
              {pending ? (otpSent ? "Проверка…" : "Отправка…") : otpSent ? "Подтвердить номер" : "Получить код"}
            </button>
          </form>

          <p className="auth-foot">
            <button
              type="button"
              className="auth-field__hint"
              onClick={() => {
                void run(
                  () => logout(),
                  async () => {
                    await router.invalidate();
                    window.location.href = "/auth/login";
                  },
                );
              }}
            >
              Выйти
            </button>
            {" · "}
            <Link to="/">На главную</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
