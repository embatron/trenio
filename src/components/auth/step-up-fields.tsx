import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouteContext } from "@tanstack/react-router";

import { issueStepUpFn } from "@/lib/auth/functions";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

export class StepUpCancelled extends Error {
  constructor() {
    super("STEP_UP_CANCELLED");
    this.name = "StepUpCancelled";
  }
}

type Settle = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

/** The current password, asked in a dialog only when a contact change needs it. */
export function useContactStepUp() {
  const { user } = useRouteContext({ from: "__root__" });
  const hasPassword = user?.hasPassword ?? false;
  const issue = useAuthServerFn(issueStepUpFn);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const waitRef = useRef<Promise<string> | null>(null);
  const settleRef = useRef<Settle | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    settleRef.current?.reject(new StepUpCancelled());
    settleRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    passwordRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function finish(token: string) {
    tokenRef.current = token;
    const settle = settleRef.current;
    settleRef.current = null;
    waitRef.current = null;
    setOpen(false);
    setPassword("");
    setHint(null);
    settle?.resolve(token);
  }

  function cancel() {
    const settle = settleRef.current;
    settleRef.current = null;
    waitRef.current = null;
    setOpen(false);
    setHint(null);
    settle?.reject(new StepUpCancelled());
  }

  function token() {
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    if (waitRef.current) return waitRef.current;
    if (!hasPassword) {
      const granted = issue({ data: {} }).then((result) => {
        tokenRef.current = result.stepUpToken;
        return result.stepUpToken;
      });
      waitRef.current = granted;
      return granted.finally(() => {
        waitRef.current = null;
      });
    }
    const pendingGrant = new Promise<string>((resolve, reject) => {
      settleRef.current = { resolve, reject };
      setOpen(true);
    });
    waitRef.current = pendingGrant;
    return pendingGrant;
  }

  function spend() {
    tokenRef.current = null;
    setPassword("");
  }

  async function submit() {
    if (!password.trim()) {
      setHint("Введите текущий пароль.");
      return;
    }
    setPending(true);
    setHint(null);
    try {
      const granted = await issue({
        data: { password: password.trim() },
      });
      finish(granted.stepUpToken);
    } catch (error) {
      setHint(authErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const fields = open
    ? createPortal(
        <div className="cabinet-modal" onClick={cancel}>
          <div
            className="cabinet-modal__card step-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="step-up-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="step-up-title">Подтвердите, что это вы</h2>
            <p>Введите текущий пароль. Так мы проверяем, что контакт меняете вы.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label>
                <span>Текущий пароль</span>
                <input
                  ref={passwordRef}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {hint ? <p className="cabinet-note" role="status">{hint}</p> : null}
              <div className="cabinet-modal__actions">
                <button type="submit" disabled={pending}>{pending ? "Проверка…" : "Продолжить"}</button>
                <button className="cabinet-form__ghost" type="button" onClick={cancel}>Отмена</button>
              </div>
            </form>
          </div>
          <style>{`
            .step-up form { display: grid; gap: 12px; }
            .step-up label { display: grid; gap: 6px; }
            .step-up label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
            .cabinet-modal__card.step-up .cabinet-form__ghost { justify-self: start; }
          `}</style>
        </div>,
        document.body,
      )
    : null;

  return { fields, token, spend };
}
