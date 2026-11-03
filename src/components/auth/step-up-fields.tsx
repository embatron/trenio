import { useRef, useState } from "react";

import { issueStepUpFn, requestStepUpCodeFn } from "@/lib/auth/functions";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

/** One password or a code to the mailbox or phone already on the account. The grant is spent by the next contact change. */
export function useContactStepUp() {
  const requestCode = useAuthServerFn(requestStepUpCodeFn);
  const issue = useAuthServerFn(issueStepUpFn);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tokenRef = useRef<string | null>(null);

  async function token() {
    if (tokenRef.current) return tokenRef.current;
    const granted = await issue({
      data: { password: password.trim() || undefined, code: code.trim() || undefined },
    });
    tokenRef.current = granted.stepUpToken;
    return granted.stepUpToken;
  }

  function spend() {
    tokenRef.current = null;
    setPassword("");
    setCode("");
  }

  async function sendCode() {
    setPending(true);
    try {
      const sent = await requestCode();
      setHint(sent.devCode ? `${sent.message} Код: ${sent.devCode}` : sent.message);
    } finally {
      setPending(false);
    }
  }

  const fields = (
    <div className="cabinet-form__actions">
      <label>
        <span>Текущий пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="cabinet-form__ghost" type="button" disabled={pending} onClick={() => void sendCode().catch(() => setHint("Не удалось отправить код."))}>
        {pending ? "Отправка…" : "Прислать код"}
      </button>
      <label>
        <span>Код</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      {hint ? <p className="cabinet-note">{hint}</p> : null}
    </div>
  );

  return { fields, token, spend };
}
