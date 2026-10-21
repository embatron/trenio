import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { honeypotFromForm, HoneypotField } from "@/components/auth/honeypot-field";
import {
  clientValidatePhone,
  PhoneOtpFields,
  useCountdown,
} from "@/components/auth/phone-otp-fields";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import {
  confirmPasswordResetSmsFn,
  forgotPasswordFn,
  requestPasswordResetSmsFn,
} from "@/lib/auth/functions";
import { BY_PHONE_COUNTRY_PREFIX } from "@/lib/auth/phone";
import { validatePasswordStrength } from "@/lib/auth/password-policy";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Восстановление пароля — trenio.by" },
      {
        name: "description",
        content: "Сбросьте пароль trenio.by по ссылке на e-mail или коду из SMS на подтверждённый телефон.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

type ResetMethod = "email" | "phone";

function ForgotPasswordPage() {
  const [method, setMethod] = useState<ResetMethod>("email");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(BY_PHONE_COUNTRY_PREFIX);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [smsSent, setSmsSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const countdown = useCountdown(0);
  const phoneFormRef = useRef<HTMLFormElement>(null);

  const forgotPassword = useAuthServerFn(forgotPasswordFn);
  const requestSms = useAuthServerFn(requestPasswordResetSmsFn);
  const confirmSms = useAuthServerFn(confirmPasswordResetSmsFn);
  const router = useRouter();
  const { error, pending, run, redirectTo } = useAuthSubmit();

  const sendSms = async (form: HTMLFormElement) => {
    const invalid = clientValidatePhone(phone);
    if (invalid) {
      setPhoneError(invalid);
      return;
    }
    setPhoneError(undefined);
    setDevCode(null);
    const result = await run(() => requestSms({ data: { phone, honeypot: honeypotFromForm(form) } }));
    if (!result) return;
    setSmsSent(true);
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
            <h1 className="auth-title">{sent ? "Проверьте почту" : "Сбросить пароль"}</h1>
            <p className="auth-sub">
              {sent
                ? `Если аккаунт с адресом ${email} существует, мы отправили ссылку. Она действует 30 минут.`
                : "Ссылка на e-mail или код на подтверждённый мобильный номер."}
            </p>
          </div>

          {!sent ? (
            <div className="auth-roleswitch" role="tablist" aria-label="Способ восстановления">
              {(
                [
                  ["email", "E-mail"],
                  ["phone", "Телефон"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={method === value}
                  className={`auth-role auth-role--compact${method === value ? " is-active" : ""}`}
                  onClick={() => setMethod(value)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          ) : null}

          <AuthAlert message={error} />
          {devCode && method === "phone" && !sent ? (
            <div className="auth-alert auth-alert--note" style={{ marginBottom: 16 }}>
              Dev-код: {devCode}
            </div>
          ) : null}

          {sent ? (
            <>
              <button type="button" className="auth-submit auth-submit--ghost" onClick={() => setSent(false)}>
                Отправить ещё раз
              </button>
              <p className="auth-foot">
                <Link to="/auth/login">Вернуться ко входу</Link>
              </p>
            </>
          ) : method === "email" ? (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () =>
                    forgotPassword({
                      data: { email, honeypot: honeypotFromForm(event.currentTarget) },
                    }),
                  () => setSent(true),
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
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Отправка…" : "Отправить ссылку"}
              </button>
            </form>
          ) : (
            <form
              ref={phoneFormRef}
              className="auth-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                if (!smsSent) {
                  void sendSms(form);
                  return;
                }
                if (password !== passwordConfirmation) {
                  setCodeError("Пароли не совпадают");
                  return;
                }
                const policyError = validatePasswordStrength(password);
                if (policyError) {
                  setCodeError(policyError);
                  return;
                }
                setCodeError(undefined);
                void run(
                  () =>
                    confirmSms({
                      data: {
                        phone,
                        code,
                        password,
                        honeypot: honeypotFromForm(form),
                      },
                    }),
                  async (result) => {
                    if (!result?.redirectTo) return;
                    await router.invalidate();
                    redirectTo(result.redirectTo);
                  },
                );
              }}
            >
              <PhoneOtpFields
                idPrefix="reset"
                phone={phone}
                onPhoneChange={setPhone}
                code={code}
                onCodeChange={setCode}
                phoneError={phoneError}
                codeError={codeError}
                sent={smsSent}
                secondsLeft={countdown.left}
                submitting={pending}
                confirmLabel="Сохранить пароль"
                onResend={() => {
                  if (phoneFormRef.current) void sendSms(phoneFormRef.current);
                }}
              >
                {smsSent ? (
                  <>
                    <label className="auth-field">
                      <span className="auth-field__label">Новый пароль</span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    <label className="auth-field">
                      <span className="auth-field__label">Повторите пароль</span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={passwordConfirmation}
                        onChange={(event) => setPasswordConfirmation(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
              </PhoneOtpFields>
            </form>
          )}

          {!sent ? (
            <p className="auth-foot">
              Вспомнили пароль? <Link to="/auth/login">Войти</Link>
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
