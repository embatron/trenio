import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { requestDoorEmailFn } from "@/lib/catalog/trainer-magic";
import { SITE_INSTAGRAM_URL } from "@/lib/seo/site";

const LOGIN_PHRASE = "Войдите в аккаунт";

function DoorMailNotice({ message }: { message: string }) {
  const index = message.indexOf(LOGIN_PHRASE);
  if (index < 0) return message;
  return (
    <>
      {message.slice(0, index)}
      <Link to="/auth/login">{LOGIN_PHRASE}</Link>
      {message.slice(index + LOGIN_PHRASE.length)}
    </>
  );
}

/** Email for an unclaimed profile opened by the short Instagram link. */
export function TrainerDoorMail({
  autoFocus = false,
  onSent,
  onDone,
}: {
  autoFocus?: boolean;
  onSent?: (email: string) => void;
  onDone?: () => void;
}) {
  const requestEmail = useAuthServerFn(requestDoorEmailFn);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send() {
    setPending(true);
    setError(null);
    void requestEmail({ data: { email: email.trim() } })
      .then((result) => {
        const message = (result as { message: string }).message;
        setSent(message);
        onSent?.(email.trim());
      })
      .catch((err: unknown) => setError(authErrorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <form
      className="door-mail"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sent) send();
      }}
    >
      {sent ? (
        <>
          <p className="door-mail__ok" id="door-mail-sent" role="status">{sent}</p>
          {onDone ? (
            <button type="button" autoFocus onClick={onDone}>Ок, понял</button>
          ) : null}
        </>
      ) : (
        <>
          <div className="door-google">
            <GoogleLoginButton returnPath="/me" door />
            <div className="auth-or" aria-hidden="true">или</div>
          </div>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus={autoFocus}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Отправка…" : "Отправить ссылку"}
          </button>
        </>
      )}
      {error ? <p className="door-mail__error" role="alert"><DoorMailNotice message={error} /></p> : null}
      <style>{`
        .door-mail { display: grid; gap: 12px; }
        .door-google { display: grid; gap: 12px; }
        .auth-or { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin: 0; color: var(--muted); font-size: 13px; }
        .auth-or::before, .auth-or::after { content: ""; height: 1px; background: rgba(var(--dark-rgb), 0.12); }
        .auth-google { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px; height: 50px; padding: 0; border-radius: var(--radius-control); border: 1px solid rgba(var(--dark-rgb), 0.14); background: #fff; color: var(--dark); font: inherit; font-size: 15px; font-weight: var(--fw-title); letter-spacing: -0.01em; text-decoration: none; cursor: pointer; }
        .auth-google:hover { border-color: var(--primary); }
        .auth-google svg { width: 18px; height: 18px; flex: 0 0 auto; }
        .door-mail label { display: grid; gap: 6px; }
        .door-mail label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
        .door-mail input { box-sizing: border-box; width: 100%; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 16px; }
        .door-mail button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
        .door-mail button:disabled { opacity: 0.6; cursor: default; }
        .door-mail__ok { margin: 0; font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
        .door-mail__error { margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
        .door-mail__error a { color: var(--primary); font-weight: var(--fw-title); text-decoration: underline; text-underline-offset: 3px; }
      `}</style>
    </form>
  );
}

function DoorMailSent({ email }: { email: string }) {
  return (
    <>
      <h2 id="door-mail-sent">Ссылка отправлена</h2>
      <p>Ссылка на {email} уже отправлена. Проверьте почту, в том числе папку «Спам».</p>
      <p>
        Если вы не видите ссылку, напишите в директ Instagram:{" "}
        <a href={SITE_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">{SITE_INSTAGRAM_URL}</a>
      </p>
    </>
  );
}

export function TrainerDoorMailDialog({
  onClose,
  sentTo,
  onRemember,
}: {
  onClose: () => void;
  sentTo: string | null;
  onRemember?: (email: string) => void;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(sentTo);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="door-mail-modal" onClick={onClose}>
      <div
        className="door-mail-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={sent ? "door-mail-sent" : "door-mail-title"}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="door-mail-modal__x" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {sent ? (
          <DoorMailSent email={sent} />
        ) : (
          <>
            <h2 id="door-mail-title">Создание аккаунта тренера</h2>
            <p>Введите свой e-mail или войдите через Google. На почту придёт ссылка сразу на страницу профиля, и создание аккаунта будет завершено. Google подтверждает адрес сразу, без письма.</p>
            <TrainerDoorMail
              autoFocus
              onSent={(email) => {
                setSent(email);
                onRemember?.(email);
                void router.invalidate();
              }}
            />
          </>
        )}
      </div>
      <style>{`
        .door-mail-modal { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
        .door-mail-modal__card { position: relative; box-sizing: border-box; width: min(440px, 100%); display: grid; gap: 12px; padding: 20px 64px 20px 20px; border-radius: var(--card-radius); background: var(--white); color: var(--text); }
        .door-mail-modal__card h2 { margin: 0; font-size: 18px; color: var(--dark); }
        .door-mail-modal__card > p { margin: 0; }
        .door-mail-modal__card a { color: var(--primary); font-weight: var(--fw-title); overflow-wrap: anywhere; }
        .door-mail-modal__x { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--muted); cursor: pointer; }
        .door-mail-modal__x svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
        .door-mail-modal__x:hover { color: var(--dark); }
      `}</style>
    </div>
  );
}
