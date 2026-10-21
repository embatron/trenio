import { useEffect, useState, type ReactNode } from "react";

import { HoneypotField } from "@/components/auth/honeypot-field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  BY_PHONE_COUNTRY_PREFIX,
  OTP_CODE_LENGTH,
  constrainBelarusPhoneInput,
  validateBelarusMobile,
} from "@/lib/auth/phone";

export function useCountdown(initial: number) {
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

export function clientValidatePhone(phone: string): string | undefined {
  return validateBelarusMobile(phone) ?? undefined;
}

export function PhoneOtpFields({
  idPrefix,
  phone,
  onPhoneChange,
  code,
  onCodeChange,
  phoneError,
  codeError,
  sent,
  secondsLeft,
  submitting,
  onResend,
  confirmLabel = "Войти",
  sendLabel = "Получить код",
  children,
}: {
  idPrefix: string;
  phone: string;
  onPhoneChange: (value: string) => void;
  code: string;
  onCodeChange: (value: string) => void;
  phoneError?: string;
  codeError?: string;
  sent: boolean;
  secondsLeft: number;
  submitting: boolean;
  onResend: () => void;
  confirmLabel?: string;
  sendLabel?: string;
  children?: ReactNode;
}) {
  const canResend = sent && secondsLeft <= 0;
  const codeReady = code.replace(/\D/g, "").length === OTP_CODE_LENGTH;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <>
      <HoneypotField />
      <label className="auth-field">
        <span className="auth-field__label">Телефон</span>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          value={phone || BY_PHONE_COUNTRY_PREFIX}
          onChange={(event) => onPhoneChange(constrainBelarusPhoneInput(event.target.value))}
        />
        {phoneError ? <span className="auth-field__error">{phoneError}</span> : null}
      </label>

      {sent ? (
        <div className="auth-field">
          <span className="auth-field__label is-required" id={`${idPrefix}-otp-label`}>
            Код из SMS
          </span>
          <InputOTP
            maxLength={OTP_CODE_LENGTH}
            value={code}
            onChange={onCodeChange}
            aria-labelledby={`${idPrefix}-otp-label`}
            containerClassName="gap-1.5"
          >
            <InputOTPGroup className="w-full gap-1.5">
              {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="h-11 w-auto flex-1 text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {codeError ? <span className="auth-field__error">{codeError}</span> : null}
          {secondsLeft > 0 ? (
            <p className="auth-muted" style={{ textAlign: "left" }}>
              Повторная отправка через {mm}:{ss}
            </p>
          ) : null}
          {canResend ? (
            <button type="button" className="auth-resend" onClick={onResend} disabled={submitting}>
              Отправить код снова
            </button>
          ) : null}
        </div>
      ) : null}

      {children}

      <button type="submit" className="auth-submit" disabled={submitting || (sent && !codeReady)}>
        {submitting ? (sent ? "Проверка…" : "Отправка…") : sent ? confirmLabel : sendLabel}
      </button>
    </>
  );
}
