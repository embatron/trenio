import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AuthStyles } from "@/components/auth-styles";
import { authErrorMessage } from "@/lib/auth/errors";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { setDoorPasswordFn } from "@/lib/catalog/trainer-magic";

function PasswordStrength({ password }: { password: string }) {
  const met = [password.length >= 8, /\d/.test(password), /[A-ZА-ЯЁ]/.test(password)].filter(Boolean).length;
  const level = password.length === 0 ? 0 : Math.max(met, 1);
  const width = password.length === 0 ? 0 : met === 0 ? 16 : (met / 3) * 100;
  return (
    <div className={`door-strength is-${level}`} aria-hidden="true">
      <svg className="door-strength__mark" viewBox="0 0 24 24">
        <path d="M5 16v3" />
        <path d="M12 11v8" />
        <path d="M19 6v13" />
      </svg>
      <span className="door-strength__track"><span style={{ width: `${width}%` }} /></span>
    </div>
  );
}

/** Password step after the magic-link mail. It stays until the password is saved. */
export function DoorPasswordDialog() {
  const router = useRouter();
  const save = useAuthServerFn(setDoorPasswordFn);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mismatch = repeat.length > 0 && repeat !== password;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || done) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const locked: HTMLElement[] = [];
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === overlay) continue;
      if (child.inert) continue;
      child.inert = true;
      child.setAttribute("data-door-password-inert", "1");
      locked.push(child);
    }
    passwordRef.current?.focus();
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
        if (node.getAttribute("data-door-password-inert") === "1") {
          node.inert = false;
          node.removeAttribute("data-door-password-inert");
        }
      }
    };
  }, [ready, done]);

  if (!ready || closed) return null;

  function close() {
    setClosed(true);
    void router.invalidate();
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="cabinet-modal cabinet-modal--lock"
      onClick={done ? close : undefined}
    >
      <AuthStyles />
      <div
        className="cabinet-modal__card door-password"
        role="dialog"
        aria-modal="true"
        aria-labelledby="door-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        {done ? (
          <>
            <button type="button" className="door-password__x" aria-label="Закрыть" onClick={close}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <h2 id="door-password-title">Аккаунт создан</h2>
            <p>{done}</p>
            <button type="button" className="auth-submit" autoFocus onClick={close}>Ок, принял</button>
          </>
        ) : (
          <>
            <h2 id="door-password-title">Пароль для кабинета</h2>
            <p>Придумайте пароль и повторите его. После этого аккаунт будет создан.</p>
            {error ? <p className="auth-alert" role="alert">{error}</p> : null}
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (password !== repeat) {
                  setError("Пароли не совпадают.");
                  return;
                }
                const policyError = validatePasswordStrength(password);
                if (policyError) {
                  setError(policyError);
                  return;
                }
                setPending(true);
                setError(null);
                void save({ data: { password, passwordConfirm: repeat } })
                  .then((result) => {
                    const message = (result as { message?: string }).message ?? "Дальше можно работать со своим аккаунтом.";
                    setDone(message);
                  })
                  .catch((err: unknown) => {
                    setError(authErrorMessage(err));
                    setPending(false);
                  });
              }}
            >
              <label className="auth-field">
                <span className="auth-field__label">Пароль</span>
                <div className="auth-field__input-wrap">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button type="button" className="auth-field__toggle" onClick={() => setShowPassword((value) => !value)}>
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
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                />
                {mismatch ? <span className="auth-field__hint auth-field__hint--block">Пароли пока не совпадают.</span> : null}
              </label>
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Сохранение…" : "Сохранить пароль"}
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`
        .door-password { position: relative; }
        .door-password:has(.door-password__x) { padding-right: 64px; }
        .cabinet-modal__card .door-password__x {
          position: absolute; top: 8px; right: 8px; left: auto;
          width: 44px; height: 44px; min-height: 44px; padding: 0;
          display: grid; place-items: center; justify-self: end; align-self: start;
          border: 0; border-radius: 50%; background: transparent; color: var(--muted);
          font-weight: var(--fw-ui, 600); cursor: pointer;
        }
        .cabinet-modal__card .door-password__x svg {
          width: 20px; height: 20px; max-width: none; display: block;
          fill: none; stroke: currentColor; stroke-width: var(--icon-stroke);
          stroke-linecap: round; stroke-linejoin: round;
        }
        .door-strength { display: flex; align-items: center; gap: 10px; min-height: 28px; }
        .door-strength__mark { width: 28px; height: 28px; flex: 0 0 auto; }
        .door-strength__mark path { fill: none; stroke: rgba(var(--dark-rgb), 0.18); stroke-width: var(--icon-stroke); stroke-linecap: round; }
        .door-strength.is-1 .door-strength__mark path:nth-child(-n+1),
        .door-strength.is-2 .door-strength__mark path:nth-child(-n+2),
        .door-strength.is-3 .door-strength__mark path { stroke: currentColor; }
        .door-strength.is-1 { color: #d97706; }
        .door-strength.is-2 { color: #ca8a04; }
        .door-strength.is-3 { color: #15803d; }
        .door-strength__track { flex: 1; height: 6px; border-radius: 999px; background: rgba(var(--dark-rgb), 0.1); overflow: hidden; }
        .door-strength__track > span { display: block; height: 100%; border-radius: inherit; background: currentColor; }
      `}</style>
    </div>,
    document.body,
  );
}
