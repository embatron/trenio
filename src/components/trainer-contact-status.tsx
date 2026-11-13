import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useContactStepUp } from "@/components/auth/step-up-fields";
import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { BelarusPhoneInput } from "@/components/belarus-phone-input";
import { PhoneCodeDialogs, usePhoneCodeDialog } from "@/components/phone-code-dialog";
import { authErrorMessage } from "@/lib/auth/errors";
import { BY_PHONE_COUNTRY_PREFIX } from "@/lib/auth/phone";
import {
  confirmAccountPhoneCodeFn,
  confirmTrainerContactEmailCodeFn,
  confirmTrainerPhoneFromTelegramFn,
  confirmTrainerTelegramFn,
  confirmTrainerTelegramWebAppFn,
  requestAccountPhoneCodeFn,
  requestTrainerContactEmailCodeFn,
  updateProfileFn,
} from "@/lib/auth/functions";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { saveOwnTrainerHeadlineFn, type OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import { getTelegramWebAppInitData, requestTelegramContact } from "@/lib/telegram-webapp";

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

export function ContactStatusMark({
  added,
  verified,
  gender,
}: {
  added: boolean;
  verified: boolean | null;
  gender: "m" | "f";
}) {
  const missingLabel = gender === "f"
    ? "Не добавлена (не видно пользователям)"
    : "Не добавлен (не видно пользователям)";
  const verifiedLabel = gender === "f" ? "Подтверждена" : "Подтверждён";
  const waitingLabel = gender === "f" ? "Не подтверждена" : "Не подтверждён";
  if (verified === true) return <VerifiedMark label={verifiedLabel} />;
  if (verified === false) return <Mark tone="wait">{waitingLabel}</Mark>;
  if (!added) return <Mark tone="off">{missingLabel}</Mark>;
  return <Mark tone="added">{gender === "f" ? "Добавлена" : "Добавлен"}</Mark>;
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
          className="cabinet-form__cta"
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

function useTelegramMiniApp() {
  const [initData, setInitData] = useState("");
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const next = getTelegramWebAppInitData();
      if (next || attempts >= 8) {
        setInitData(next);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return initData;
}

function TelegramConfirm({ intent }: { intent: "add" | "confirm" }) {
  const router = useRouter();
  const confirm = useAuthServerFn(confirmTrainerTelegramFn);
  const confirmWebApp = useAuthServerFn(confirmTrainerTelegramWebAppFn);
  const initData = useTelegramMiniApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const label = intent === "add" ? "Добавить" : "Подтвердить";
  const step = useContactStepUp();

  function finish(task: Promise<{ message: string }>) {
    setPending(true);
    setStatus("");
    void task
      .then(async (result) => {
        setStatus(result.message);
        await router.invalidate();
      })
      .catch((err: unknown) => setStatus(authErrorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <>
      {initData ? (
        <>
          {step.fields}
          <div className="cabinet-contact__actions">
            <button
              className="cabinet-form__cta"
              type="button"
              disabled={pending}
              onClick={() => {
                finish(
                  requestTelegramContact().then(async (contact) => {
                    const stepUpToken = await step.token();
                    const result = await (confirmWebApp({
                      data: { initData, contact: contact ?? undefined, stepUpToken },
                    }) as Promise<{ message: string }>);
                    step.spend();
                    return result;
                  }),
                );
              }}
            >
              {pending ? "Проверяем…" : label}
            </button>
          </div>
        </>
      ) : open ? (
        <>
          {step.fields}
          <TelegramLoginButton
            missing="Кнопка бота сейчас не открывается."
            onAuth={(user: TelegramWidgetUser) => {
              if (pending) return;
              finish((async () => {
                const stepUpToken = await step.token();
                const result = await (confirm({ data: { ...user, stepUpToken } }) as Promise<{ message: string }>);
                step.spend();
                return result;
              })());
            }}
          />
        </>
      ) : (
        <div className="cabinet-contact__actions">
          <button className="cabinet-form__cta" type="button" onClick={() => setOpen(true)}>{label}</button>
        </div>
      )}
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </>
  );
}

function TelegramPhoneButton() {
  const router = useRouter();
  const confirm = useAuthServerFn(confirmTrainerPhoneFromTelegramFn);
  const initData = useTelegramMiniApp();
  const step = useContactStepUp();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  if (!initData) return null;

  return (
    <>
      {step.fields}
      <button
        className="cabinet-form__cta"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setStatus("");
          void requestTelegramContact()
            .then(async (contact) => {
              if (!contact) {
                setStatus("Номер не передан. Телефон и Telegram не изменены.");
                return null;
              }
              const stepUpToken = await step.token();
              const result = await confirm({ data: { initData, contact, stepUpToken } });
              step.spend();
              return result as { message: string };
            })
            .then(async (result) => {
              if (!result) return;
              setStatus(result.message);
              await router.invalidate();
            })
            .catch((err: unknown) => setStatus(authErrorMessage(err)))
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Проверяем…" : "Взять номер из Telegram"}
      </button>
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
  return (
    <div className="cabinet-contact">
      <span className="cabinet-contact__icon" aria-hidden="true">{icon}</span>
      <span className="cabinet-contact__body">
        <span className="cabinet-contact__name">{label}</span>
        {added ? <span className="cabinet-contact__value">{value}</span> : null}
      </span>
      <span className="cabinet-contact__marks">
        <ContactStatusMark added={added} verified={verified} gender={gender} />
      </span>
      {(!added && editor) || (verified === false && confirm) ? (
        <div className="cabinet-contact__panel">
          {!added ? editor : null}
          {verified === false ? confirm : null}
        </div>
      ) : null}
    </div>
  );
}

function PhoneSmsActions({
  phone,
  requestLabel,
  onRequest,
  field,
}: {
  phone: string;
  requestLabel: string;
  onRequest: (phone: string) => Promise<{ message: string; already?: boolean; devCode?: string }>;
  field?: ReactNode;
}) {
  const router = useRouter();
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const codeDialog = usePhoneCodeDialog(() => {
    void router.invalidate();
  });
  const phoneRef = useRef(phone);
  useEffect(() => {
    if (phoneRef.current === phone) return;
    phoneRef.current = phone;
    codeDialog.reset();
  }, [phone, codeDialog.reset]);

  const actions = (
    <div className="cabinet-contact__actions">
      <button
        className="cabinet-form__cta"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setStatus("");
          void onRequest(phone)
            .then((result) => {
              codeDialog.openFromRequest(result);
            })
            .catch((err: unknown) => setStatus(authErrorMessage(err)))
            .finally(() => setPending(false));
        }}
      >
        {requestLabel}
      </button>
      {codeDialog.issued && codeDialog.phase === "closed" ? (
        <button className="cabinet-form__cta" type="button" onClick={codeDialog.reopen}>Ввести код</button>
      ) : null}
      <TelegramPhoneButton />
    </div>
  );

  return (
    <>
      {field ? (
        <div className="cabinet-contact__phone">
          {field}
          {actions}
        </div>
      ) : actions}
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
      <PhoneCodeDialogs
        phase={codeDialog.phase}
        code={codeDialog.code}
        error={codeDialog.error}
        pending={codeDialog.pending}
        devCode={codeDialog.devCode}
        doneMessage={codeDialog.doneMessage}
        onCode={codeDialog.setCode}
        onSubmit={() => {
          void codeDialog.submit(
            () => confirmPhone({ data: { phone, code: codeDialog.code } }) as Promise<{ message: string }>,
          );
        }}
        onCloseCode={codeDialog.closeCode}
        onCloseDone={codeDialog.closeDone}
      />
    </>
  );
}

function PhoneEditor({
  onRequest,
}: {
  onRequest: (phone: string) => Promise<{ message: string; already?: boolean; devCode?: string }>;
}) {
  const [value, setValue] = useState(BY_PHONE_COUNTRY_PREFIX);

  return (
    <PhoneSmsActions
      phone={value}
      requestLabel="Подтвердить по SMS"
      onRequest={onRequest}
      field={(
        <BelarusPhoneInput
          value={value}
          onValue={setValue}
          aria-label="Телефон"
          autoComplete="tel"
        />
      )}
    />
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
          className="cabinet-form__cta"
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

export function TrainerIdentityFields({ profile }: { profile: OwnTrainerProfile }) {
  const router = useRouter();
  const updateProfile = useAuthServerFn(updateProfileFn);
  const saveHeadline = useAuthServerFn(saveOwnTrainerHeadlineFn);
  const [given, setGiven] = useState(profile.firstName);
  const [family, setFamily] = useState(profile.lastName);
  const [headline, setHeadline] = useState(profile.headline);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setGiven(profile.firstName);
    setFamily(profile.lastName);
    setHeadline(profile.headline);
  }, [profile.firstName, profile.lastName, profile.headline]);

  return (
    <form
      className="cabinet-form"
      onSubmit={(event) => {
        event.preventDefault();
        const nextFirst = given.trim();
        const nextLast = family.trim();
        const nextHeadline = headline.trim();
        if (!nextFirst) {
          setStatus("Укажите имя.");
          return;
        }
        if (!nextHeadline) {
          setStatus("Укажите заголовок страницы.");
          return;
        }
        setPending(true);
        setStatus("");
        void updateProfile({ data: { firstName: nextFirst, lastName: nextLast } })
          .then(() => saveHeadline({ data: { headline: nextHeadline } }))
          .then(async () => {
            setStatus("Сохранено.");
            await router.invalidate();
          })
          .catch((error) => setStatus(authErrorMessage(error) || "Не удалось сохранить."))
          .finally(() => setPending(false));
      }}
    >
      <label>
        <span>Заголовок страницы</span>
        <input
          name="headline"
          required
          value={headline}
          maxLength={200}
          placeholder="Фитнес-тренер"
          onChange={(event) => setHeadline(event.target.value)}
        />
      </label>
      <div className="cabinet-form__row">
        <label>
          <span>Имя</span>
          <input
            required
            value={given}
            maxLength={100}
            autoComplete="given-name"
            onChange={(event) => setGiven(event.target.value)}
          />
        </label>
        <label>
          <span>Фамилия, необязательно</span>
          <input
            value={family}
            maxLength={100}
            autoComplete="family-name"
            onChange={(event) => setFamily(event.target.value)}
          />
        </label>
      </div>
      <button className="cabinet-form__submit" type="submit" disabled={pending}>
        {pending ? "Сохранение…" : "Сохранить"}
      </button>
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </form>
  );
}

export function TrainerContactStatus({ profile }: { profile: OwnTrainerProfile }) {
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const requestEmail = useAuthServerFn(requestTrainerContactEmailCodeFn);
  const confirmEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);
  const phone = profile.phone.trim();
  const step = useContactStepUp();
  const instagram = profile.instagram.trim();
  const telegram = profile.telegram.trim();
  const email = profile.email.trim();

  return (
    <div className="cabinet-contacts">
      {step.fields}
      <Row
        icon={<LineIcon path={PHONE_PATH} />}
        label="Телефон"
        value={phone}
        added={Boolean(phone)}
        verified={phone ? profile.phoneVerified : null}
        gender="m"
        editor={(
          <PhoneEditor
            onRequest={async (next) => {
              const stepUpToken = await step.token();
              const result = await requestPhone({ data: { phone: next, stepUpToken } });
              step.spend();
              return result as { message: string; already?: boolean; devCode?: string };
            }}
          />
        )}
        confirm={(
          <PhoneSmsActions
            phone={phone}
            requestLabel="Подтвердить"
            onRequest={async (next) => {
              const stepUpToken = await step.token();
              const result = await requestPhone({ data: { phone: next, stepUpToken } });
              step.spend();
              return result as { message: string; already?: boolean; devCode?: string };
            }}
          />
        )}
      />
      <Row
        icon={<InstagramIcon />}
        label="Instagram"
        value={channelLabel(instagram, "instagram")}
        added={Boolean(instagram)}
        verified={instagram ? true : null}
        gender="m"
      />
      <Row
        icon={<TelegramIcon />}
        label="Telegram"
        value={channelLabel(telegram, "telegram")}
        added={Boolean(telegram)}
        verified={telegram ? profile.telegramVerified : null}
        gender="m"
        editor={<TelegramConfirm intent="add" />}
        confirm={<TelegramConfirm intent="confirm" />}
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
            onRequest={async (next) => {
              const stepUpToken = await step.token();
              const result = await requestEmail({ data: { email: next, stepUpToken } });
              step.spend();
              return result as { message: string; already?: boolean; devCode?: string };
            }}
          />
        )}
        confirm={email && !profile.emailVerified ? (
          <CodeConfirm
            codeLabel="Код из письма"
            request={async () => {
              const stepUpToken = await step.token();
              const result = await requestEmail({ data: { email, stepUpToken } });
              step.spend();
              return result as { message: string; already?: boolean; devCode?: string };
            }}
            confirm={(code) => confirmEmail({ data: { email, code } }) as Promise<{ message: string }>}
          />
        ) : null}
      />
    </div>
  );
}
