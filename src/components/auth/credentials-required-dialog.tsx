import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AuthStyles } from "@/components/auth-styles";
import { completeSignupCredentialsFn } from "@/lib/auth/functions";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";

export function CredentialsRequiredDialog() {
  const router = useRouter();
  const save = useAuthServerFn(completeSignupCredentialsFn);
  const { error, pending, run } = useAuthSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
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
          onSubmit={(event) => {
            event.preventDefault();
            if (password !== repeat) {
              setMismatch("Пароли не совпадают.");
              return;
            }
            setMismatch(null);
            void run(
              () => save({ data: { email, password } }),
              async (result) => {
                if (!result) return;
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
            <span className="auth-field__hint auth-field__hint--block">Цифра и заглавная буква.</span>
          </label>
          <label className="auth-field">
            <span className="auth-field__label">Пароль ещё раз</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Повторите пароль"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </label>
          <button type="submit" className="auth-submit" disabled={pending}>
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
