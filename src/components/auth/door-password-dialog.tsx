import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AuthStyles } from "@/components/auth-styles";
import { PasswordStrength } from "@/components/auth/password-strength";
import { authErrorMessage } from "@/lib/auth/errors";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { setDoorPasswordFn } from "@/lib/catalog/trainer-magic";

/** Password step after the magic-link mail. It stays until the password is saved. */
export function DoorPasswordDialog() {
  const save = useAuthServerFn(setDoorPasswordFn);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mismatch = repeat.length > 0 && repeat !== password;

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
  }, [ready]);

  if (!ready) return null;

  return createPortal(
    <div ref={overlayRef} className="cabinet-modal cabinet-modal--lock">
      <AuthStyles />
      <div
        className="cabinet-modal__card door-password"
        role="dialog"
        aria-modal="true"
        aria-labelledby="door-password-title"
        onClick={(event) => event.stopPropagation()}
      >
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
                  .then(() => {
                    window.location.assign("/me/profile?created=1");
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
      </div>
      <style>{`
        .cabinet-modal.cabinet-modal--lock {
          position: fixed; inset: 0; z-index: 400; display: grid; place-items: center;
          padding: var(--layout-gutter); background: rgba(var(--dark-rgb), 0.45);
        }
        .cabinet-modal--lock .cabinet-modal__card {
          width: min(440px, 100%); display: grid; gap: 12px; padding: 20px;
          border-radius: var(--card-radius); background: var(--white);
        }
        .cabinet-modal--lock .cabinet-modal__card h2 { margin: 0; color: var(--dark); font-size: 22px; }
        .cabinet-modal--lock .cabinet-modal__card p { margin: 0; color: var(--text); }
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
      `}</style>
    </div>,
    document.body,
  );
}
