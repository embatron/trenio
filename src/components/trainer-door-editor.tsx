import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { confirmDoorEmailFn, requestDoorEmailFn } from "@/lib/catalog/trainer-magic";

/** Email confirmation for an unclaimed profile opened by the short Instagram link. */
export function TrainerDoorMail() {
  const requestEmail = useAuthServerFn(requestDoorEmailFn);
  const confirmEmail = useAuthServerFn(confirmDoorEmailFn);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<string>) {
    setPending(true);
    setError(null);
    void task()
      .then((message) => setNote(message))
      .catch((err: unknown) => setError(authErrorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <div className="door-mail">
      <p className="cabinet-note cabinet-note--lede">
        Почта делает аккаунт активным. Код и ссылка приходят на этот адрес, ссылка из письма открывает кабинет.
      </p>
      <div className="cabinet-form">
        <div className="door-mail__row">
          <label>
            <span>Почта</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              disabled={active}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            className="cabinet-form__submit"
            type="button"
            disabled={pending || active}
            onClick={() => run(async () => {
              const result = await requestEmail({ data: { email: email.trim() } }) as { message: string; devCode?: string };
              setSent(true);
              return result.devCode ? `${result.message} Код для проверки: ${result.devCode}` : result.message;
            })}
          >
            Отправить код
          </button>
        </div>
        {sent && !active ? (
          <div className="door-mail__row">
            <label>
              <span>Код из письма</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <button
              className="cabinet-form__submit"
              type="button"
              disabled={pending}
              onClick={() => run(async () => {
                const result = await confirmEmail({ data: { email: email.trim(), code } }) as { message: string };
                setActive(true);
                return result.message;
              })}
            >
              Подтвердить почту
            </button>
          </div>
        ) : null}
        {active ? <p className="cabinet-form__ok">Почта подтверждена. <Link to="/me/profile">Открыть редактирование в кабинете</Link></p> : null}
        {error ? <p className="cabinet-form__error">{error}</p> : null}
        {note && !active ? <p className="cabinet-form__ok">{note}</p> : null}
      </div>
      <style>{`
        .door-mail { display: grid; gap: 12px; margin: 0 0 20px; }
        .door-mail__row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
        .door-mail__row label { flex: 1 1 220px; }
        .door-mail__row button { min-height: 44px; }
      `}</style>
    </div>
  );
}
