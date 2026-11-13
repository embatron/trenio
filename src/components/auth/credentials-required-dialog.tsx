import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AuthStyles } from "@/components/auth-styles";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  completeSignupCredentialsFn,
  confirmSignupCodeFn,
  confirmSignupLinkFn,
  logoutFn,
  requestSignupLinkFn,
} from "@/lib/auth/functions";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { logoutWithShell } from "@/lib/native/shell";

export function CredentialsRequiredDialog() {
  const router = useRouter();
  const save = useAuthServerFn(completeSignupCredentialsFn);
  const confirmCode = useAuthServerFn(confirmSignupCodeFn);
  const requestLink = useAuthServerFn(requestSignupLinkFn);
  const confirmLink = useAuthServerFn(confirmSignupLinkFn);
  const logout = useAuthServerFn(logoutFn);
  const { error, pending, run } = useAuthSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"form" | "code" | "link">("form");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const locked: HTMLElement[] = [];
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === overlay) continue;
      if (child.inert) continue;
      child.inert = true;
      child.setAttribute("data-credentials-inert", "1");
      locked.push(child);
    }
    emailRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("is-credentials-locked");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove("is-credentials-locked");
      for (const node of locked) {
        if (node.getAttribute("data-credentials-inert") === "1") {
          node.inert = false;
          node.removeAttribute("data-credentials-inert");
        }
      }
    };
  }, [ready]);

  if (!ready) return null;

  return createPortal(
    <div ref={overlayRef} className="cabinet-modal cabinet-modal--lock">
      <AuthStyles />
      <div
        className="cabinet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-credentials-title"
      >
        <h2 id="signup-credentials-title">Почта и пароль</h2>
        <p>
          Телефон или Telegram уже подтверждены. Укажите почту и придумайте пароль — без этого кабинет не откроется.
        </p>
        <AuthAlert message={mismatch ?? error} />
        <form
          className="auth-form"
          style={{ display: phase === "form" ? undefined : "none" }}
          onSubmit={(event) => {
            event.preventDefault();
            if (password !== repeat) {
              setMismatch("Пароли не совпадают.");
              return;
            }
            const policyError = validatePasswordStrength(password);
            if (policyError) {
              setMismatch(policyError);
              return;
            }
            setMismatch(null);
            void run(
              () => save({ data: { email, password } }),
              async (result) => {
                if (!result) return;
                if ("linkAvailable" in result && result.linkAvailable) {
                  setPhase("link");
                  return;
                }
                if ("needsCode" in result && result.needsCode) {
                  setDevCode(result.devCode ?? null);
                  setPhase("code");
                  return;
                }
                await router.invalidate();
              },
            );
          }}
        >
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="auth-field">
            <span className="auth-field__label">Пароль</span>
            <div className="auth-field__input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                maxLength={128}
                placeholder="Минимум 8 символов"
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
          <label className="auth-field">
            <span className="auth-field__label">Пароль ещё раз</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              maxLength={128}
              autoComplete="new-password"
              placeholder="Повторите пароль"
              aria-invalid={repeat.length > 0 && repeat !== password}
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
            {repeat.length > 0 && repeat !== password ? (
              <span className="auth-field__hint auth-field__hint--block">Пароли пока не совпадают.</span>
            ) : null}
          </label>
          <button type="submit" className="auth-submit" disabled={pending}>
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
        {phase !== "form" ? (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (phase === "link" && !code.trim()) {
                  const sent = await requestLink({ data: { email } });
                  setDevCode(sent.devCode ?? null);
                  return { ok: true as const };
                }
                if (phase === "link") {
                  return confirmLink({ data: { email, code } });
                }
                await confirmCode({ data: { email, code } });
                return { ok: true as const };
              }, async (result) => {
                if (!result) return;
                if (result && "redirectTo" in result && result.redirectTo) {
                  window.location.assign(result.redirectTo);
                  return;
                }
                await router.invalidate();
              });
            }}
          >
            <p>{phase === "link" ? "Эта почта уже подтверждена. Введите код из письма, чтобы связать аккаунты." : "Введите код из письма. Почта станет входом только после кода."}</p>
            {devCode ? <p className="auth-alert auth-alert--note">Dev-код: {devCode}</p> : null}
            <label className="auth-field">
              <span className="auth-field__label">Код</span>
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required={phase !== "link"} />
            </label>
            <button type="submit" className="auth-submit" disabled={pending}>
              {pending ? "Проверка…" : phase === "link" && !code.trim() ? "Прислать код" : "Подтвердить"}
            </button>
          </form>
        ) : null}
        <button
          type="button"
          className="auth-submit"
          onClick={() => {
            void logoutWithShell(() => logout()).then(() => {
              window.location.assign("/");
            });
          }}
        >
          Выйти
        </button>
      </div>
    </div>,
    document.body,
  );
}
