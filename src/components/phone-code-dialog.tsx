import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { authErrorMessage } from "@/lib/auth/errors";

export type PhoneCodeRequest = { message: string; already?: boolean; devCode?: string };

function retryMessage(error: unknown): string {
  const message = authErrorMessage(error);
  if (/неверн|устаревш/i.test(message)) return "Неверный код. Попробуйте ещё раз.";
  return message;
}

/** Code entry, then a success dialog. The page refreshes only after «Ок, спасибо». */
export function usePhoneCodeDialog(onFinished: () => void) {
  const [phase, setPhase] = useState<"closed" | "code" | "done">("closed");
  const [code, setCodeValue] = useState("");
  function setCode(value: string) {
    setCodeValue(value);
    setError("");
  }
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [doneMessage, setDoneMessage] = useState("Номер добавлен и подтверждён.");
  const [issued, setIssued] = useState(false);

  function openFromRequest(result: PhoneCodeRequest) {
    if (result.already) {
      setDoneMessage(result.message || "Телефон уже подтверждён.");
      setPhase("done");
      return;
    }
    setDevCode(result.devCode ?? "");
    setCodeValue("");
    setError("");
    setIssued(true);
    setPhase("code");
  }

  async function submit(confirm: () => Promise<{ message: string }>) {
    if (!code.trim()) {
      setError("Введите код из SMS.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await confirm();
      setDoneMessage(result.message || "Номер добавлен и подтверждён.");
      setIssued(false);
      setPhase("done");
    } catch (err) {
      setError(retryMessage(err));
    } finally {
      setPending(false);
    }
  }

  function closeCode() {
    if (pending) return;
    setPhase("closed");
    setError("");
  }

  function reopen() {
    setError("");
    setPhase("code");
  }

  function closeDone() {
    setPhase("closed");
    setCodeValue("");
    setDevCode("");
    setIssued(false);
    onFinished();
  }

  const reset = useCallback(() => {
    setPhase("closed");
    setCodeValue("");
    setError("");
    setDevCode("");
    setIssued(false);
  }, []);

  return {
    phase,
    code,
    setCode,
    error,
    pending,
    devCode,
    doneMessage,
    issued,
    openFromRequest,
    submit,
    closeCode,
    reopen,
    closeDone,
    reset,
  };
}

export function PhoneCodeDialogs({
  phase,
  code,
  error,
  pending,
  devCode,
  doneMessage,
  onCode,
  onSubmit,
  onCloseCode,
  onCloseDone,
}: {
  phase: "closed" | "code" | "done";
  code: string;
  error: string;
  pending: boolean;
  devCode: string;
  doneMessage: string;
  onCode: (value: string) => void;
  onSubmit: () => void;
  onCloseCode: () => void;
  onCloseDone: () => void;
}) {
  const titleId = useId();
  const onClose = phase === "done" ? onCloseDone : onCloseCode;

  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  if (phase === "closed" || typeof document === "undefined") return null;

  return createPortal(
    <div className="cabinet-modal" onClick={onClose}>
      <div
        className="cabinet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        {phase === "code" ? (
          <>
            <h2 id={titleId}>Код из SMS</h2>
            <p>Введите код из сообщения.</p>
            {devCode ? <p>Код: {devCode}</p> : null}
            <label>
              <span>Код</span>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                aria-invalid={Boolean(error)}
                value={code}
                onChange={(event) => onCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
            </label>
            {error ? <p className="cabinet-form__error" role="alert">{error}</p> : null}
            <button type="button" disabled={pending} onClick={onSubmit}>{pending ? "Проверяем…" : "Ок, спасибо"}</button>
          </>
        ) : (
          <>
            <h2 id={titleId}>Телефон подтверждён</h2>
            <p>{doneMessage}</p>
            <button type="button" autoFocus onClick={onCloseDone}>Ок, спасибо</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
