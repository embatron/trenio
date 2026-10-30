import { useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  confirmAccountPhoneCodeFn,
  confirmTrainerContactEmailCodeFn,
  confirmTrainerTelegramFn,
  requestAccountPhoneCodeFn,
  requestTrainerContactEmailCodeFn,
} from "@/lib/auth/functions";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import type { OwnTrainerProfile } from "@/lib/catalog/trainer-own";

const PHONE_PATH = "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";
function LineIcon({ path }: { path: string }) {
  return (
    <svg className="cabinet-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="cabinet-line" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function VerifiedMark({ label }: { label: string }) {
  return (
    <span className="cabinet-mark cabinet-mark--on cabinet-mark--sign" role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

function channelLabel(raw: string, kind: "instagram" | "telegram") {
  const handle = kind === "instagram"
    ? raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1]
    : raw.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/i)?.[1] ?? raw.replace(/^@/, "");
  if (!handle) return raw;
  return kind === "instagram" ? `@${handle}` : `@${handle.replace(/^@/, "")}`;
}

function Mark({ tone, children }: { tone: "on" | "wait" | "off" | "added"; children: string }) {
  return <span className={`cabinet-mark cabinet-mark--${tone}`}>{children}</span>;
}

function CodeConfirm({
  request,
  confirm,
  codeLabel,
}: {
  request: () => Promise<{ message: string; already?: boolean; devCode?: string }>;
  confirm: (code: string) => Promise<{ message: string }>;
  codeLabel: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <>
      {sent ? (
        <label>
          <span className="is-required">{codeLabel}</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      ) : null}
      <div className="cabinet-contact__actions">
        <button
          className="cabinet-form__ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setStatus("");
            const task = sent
              ? confirm(code).then(async (result) => {
                  setStatus(result.message);
                  setSent(false);
                  setCode("");
                  await router.invalidate();
                })
              : request().then(async (result) => {
                  setStatus(result.devCode ? `${result.message} Код: ${result.devCode}` : result.message);
                  setSent(!result.already);
                  if (result.already) await router.invalidate();
                });
            void task.catch((err: unknown) => setStatus(authErrorMessage(err))).finally(() => setPending(false));
          }}
        >
          {sent ? "Подтвердить код" : "Подтвердить"}
        </button>
      </div>
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </>
  );
}

function TelegramConfirm() {
  const router = useRouter();
  const confirm = useAuthServerFn(confirmTrainerTelegramFn);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <>
      {open ? (
        <TelegramLoginButton
          missing="Кнопка бота сейчас не открывается."
          onAuth={(user: TelegramWidgetUser) => {
            if (pending) return;
            setPending(true);
            setStatus("");
            void confirm({ data: user })
              .then(async (result) => {
                setStatus((result as { message: string }).message);
                await router.invalidate();
              })
              .catch((err: unknown) => setStatus(authErrorMessage(err)))
              .finally(() => setPending(false));
          }}
        />
      ) : (
        <div className="cabinet-contact__actions">
          <button className="cabinet-form__ghost" type="button" onClick={() => setOpen(true)}>Подтвердить</button>
        </div>
      )}
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </>
  );
}

function Row({
  icon,
  label,
  value,
  added,
  verified,
  gender,
  confirm,
  editor,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  added: boolean;
  verified: boolean | null;
  gender: "m" | "f";
  confirm?: ReactNode;
  editor?: ReactNode;
}) {
  const missingLabel = gender === "f" ? "Не добавлена" : "Не добавлен";
  const verifiedLabel = gender === "f" ? "Подтверждена" : "Подтверждён";
  const waitingLabel = gender === "f" ? "Не подтверждена" : "Не подтверждён";
  return (
    <div className="cabinet-contact">
      <span className="cabinet-contact__icon" aria-hidden="true">{icon}</span>
      <span className="cabinet-contact__body">
        <span className="cabinet-contact__name">{label}</span>
        {added ? <span className="cabinet-contact__value">{value}</span> : editor ?? null}
      </span>
      <span className="cabinet-contact__marks">
        {verified === true ? <VerifiedMark label={verifiedLabel} /> : null}
        {verified === false ? <Mark tone="wait">{waitingLabel}</Mark> : null}
        {verified === null && !added ? <Mark tone="off">{missingLabel}</Mark> : null}
        {verified === null && added ? <Mark tone="added">{gender === "f" ? "Добавлена" : "Добавлен"}</Mark> : null}
      </span>
      {verified === false && confirm ? <div className="cabinet-contact__panel">{confirm}</div> : null}
    </div>
  );
}

function EmailEditor({
  onRequest,
}: {
  onRequest: (email: string) => Promise<{ message: string; already?: boolean; devCode?: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const confirmEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);

  return (
    <div className="cabinet-contact__field">
      <input
        type="email"
        inputMode="email"
        autoComplete="off"
        maxLength={320}
        placeholder="name@example.com"
        aria-label="Почта"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSent(false);
        }}
      />
      {sent ? (
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          aria-label="Код из письма"
          placeholder="Код из письма"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      ) : null}
      <div className="cabinet-contact__actions">
        <button
          className="cabinet-form__ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setStatus("");
            const task = sent
              ? confirmEmail({ data: { email: value, code } }).then(async (result) => {
                  setStatus((result as { message: string }).message);
                  await router.invalidate();
                })
              : onRequest(value).then(async (result) => {
                  setStatus(result.devCode ? `${result.message} Код: ${result.devCode}` : result.message);
                  setSent(!result.already);
                  if (result.already) await router.invalidate();
                });
            void task.catch((err: unknown) => setStatus(authErrorMessage(err))).finally(() => setPending(false));
          }}
        >
          {sent ? "Подтвердить код" : "Подтвердить"}
        </button>
      </div>
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </div>
  );
}

export function TrainerContactStatus({ profile }: { profile: OwnTrainerProfile }) {
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const requestEmail = useAuthServerFn(requestTrainerContactEmailCodeFn);
  const confirmEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);
  const phone = profile.phone.trim();
  const instagram = profile.instagram.trim();
  const telegram = profile.telegram.trim();
  const email = profile.email.trim();

  return (
    <div className="cabinet-contacts">
      <Row
        icon={<LineIcon path={PHONE_PATH} />}
        label="Телефон"
        value={phone}
        added={Boolean(phone)}
        verified={phone ? profile.phoneVerified : null}
        gender="m"
        confirm={(
          <CodeConfirm
            codeLabel="Код из SMS"
            request={() => requestPhone({ data: { phone } }) as Promise<{ message: string; already?: boolean; devCode?: string }>}
            confirm={(code) => confirmPhone({ data: { phone, code } }) as Promise<{ message: string }>}
          />
        )}
      />
      <Row
        icon={<InstagramIcon />}
        label="Instagram"
        value={channelLabel(instagram, "instagram")}
        added={Boolean(instagram)}
        verified={null}
        gender="m"
      />
      <Row
        icon={<TelegramIcon />}
        label="Telegram"
        value={channelLabel(telegram, "telegram")}
        added={Boolean(telegram)}
        verified={telegram ? profile.telegramVerified : null}
        gender="m"
        confirm={<TelegramConfirm />}
      />
      <Row
        icon={<MailIcon />}
        label="Почта"
        value={email}
        added={Boolean(email)}
        verified={email ? profile.emailVerified : null}
        gender="f"
        editor={(
          <EmailEditor
            onRequest={(next) => requestEmail({ data: { email: next } }) as Promise<{ message: string; already?: boolean; devCode?: string }>}
          />
        )}
        confirm={email && !profile.emailVerified ? (
          <CodeConfirm
            codeLabel="Код из письма"
            request={() => requestEmail({ data: { email } }) as Promise<{ message: string; already?: boolean; devCode?: string }>}
            confirm={(code) => confirmEmail({ data: { email, code } }) as Promise<{ message: string }>}
          />
        ) : null}
      />
    </div>
  );
}
