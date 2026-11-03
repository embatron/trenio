import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { useContactStepUp } from "@/components/auth/step-up-fields";
import { AvatarCrop } from "@/components/avatar-crop";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { TelegramWebAppAuthButton } from "@/components/auth/telegram-webapp-auth-button";
import { BelarusPhoneInput } from "@/components/belarus-phone-input";
import { CabinetNotice } from "@/components/cabinet";
import { UserAvatar } from "@/components/user-avatar";
import { constrainBelarusPhoneInput, BY_PHONE_COUNTRY_PREFIX } from "@/lib/auth/phone";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  changePasswordFn,
  confirmAccountEmailCodeFn,
  confirmAccountPhoneCodeFn,
  deleteAccountFn,
  linkAccountTelegramFn,
  linkAccountTelegramWebAppFn,
  listSessionsFn,
  requestAccountEmailCodeFn,
  requestAccountPhoneCodeFn,
  revokeSessionFn,
  setAccountAvatarFn,
  unlinkAccountTelegramFn,
  updateMailPreferenceFn,
  updateProfileFn,
} from "@/lib/auth/functions";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";
import type { MailKind } from "@/lib/mail/kinds";
import { BECOME_TRAINER_MAX, requestBecomeTrainerFn } from "@/lib/account/become-trainer";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { publishLiveAvatar, useLiveAvatar } from "@/lib/auth/live-avatar";
import { variantImagePath } from "@/lib/images/variants";
import { hasAnyRole, isStaff, ROLE_LABELS } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/schemas";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

/** The circle uses the 128px file. Wait for that response so the old cached face is not painted again. */
function preloadAvatar(src: string): Promise<void> {
  const url = variantImagePath(src, "s128");
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    const timer = window.setTimeout(done, 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      done();
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      done();
    };
    img.src = url;
  });
}

const ACCOUNT_STATUS: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

function showPhone(phone: string | null) {
  return constrainBelarusPhoneInput(phone || BY_PHONE_COUNTRY_PREFIX);
}

const MAIL_ROWS: Array<{ kind: MailKind; label: string; hint: string }> = [
  { kind: "messages", label: "Сообщения", hint: "Письмо, когда вам написали в переписке." },
  { kind: "reviews", label: "Отзывы", hint: "Письмо, когда ваш отзыв опубликован или отклонён." },
  {
    kind: "site",
    label: "Оповещения с сайта",
    hint: "Служебные новости кабинета. Они включены всегда.",
  },
  {
    kind: "marketing",
    label: "Маркетинговые рассылки",
    hint: "Новости trenio.by и подборки тренеров. Без согласия не отправляем.",
  },
];

function mailFromUser(user: PublicUser) {
  return {
    messages: user.mailMessages,
    reviews: user.mailReviews,
    site: user.mailSite,
    marketing: user.mailMarketing,
  };
}

function TelegramAccountLink({
  user,
  onOk,
  onFail,
}: {
  user: PublicUser;
  onOk: (message: string) => void;
  onFail: (error: unknown) => void;
}) {
  const router = useRouter();
  const linkWidget = useAuthServerFn(linkAccountTelegramFn);
  const linkWebApp = useAuthServerFn(linkAccountTelegramWebAppFn);
  const unlink = useAuthServerFn(unlinkAccountTelegramFn);
  const step = useContactStepUp();
  const [pending, setPending] = useState(false);

  async function finish(message: string) {
    onOk(message);
    await router.invalidate();
  }

  return (
    <section className="cabinet-form" id="telegram">
      <h3>Telegram</h3>
      {step.fields}
      {user.telegramLinked ? (
        <>
          <p className="cabinet-note">
            {user.telegramUsername
              ? `Контакт @${user.telegramUsername} подтверждён.`
              : "Контакт Telegram подтверждён."}
          </p>
          <button
            className="cabinet-form__ghost"
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void step.token()
                .then((stepUpToken) => unlink({ data: { stepUpToken } }))
                .then((result) => {
                  step.spend();
                  return finish((result as { message: string }).message);
                })
                .catch(onFail)
                .finally(() => setPending(false));
            }}
          >
            {pending ? "Отвязка…" : "Отвязать Telegram"}
          </button>
        </>
      ) : (
        <>
          <p className="cabinet-note">
            Подтвердите Telegram. Это контакт на вашей странице, второй аккаунт с ним не создаётся.
          </p>
          <TelegramWebAppAuthButton
            label="Подтвердить Telegram"
            pendingLabel="Привязка…"
            onAuth={async (initData) => {
              try {
                const stepUpToken = await step.token();
                const result = await linkWebApp({ data: { initData, stepUpToken } });
                step.spend();
                await finish((result as { message: string }).message);
              } catch (error) {
                onFail(error);
              }
            }}
          />
          <TelegramLoginButton
            missing="Привязка через Telegram сейчас недоступна."
            onAuth={(telegram: TelegramWidgetUser) => {
              setPending(true);
              void step.token()
                .then((stepUpToken) => linkWidget({ data: { ...telegram, stepUpToken } }))
                .then((result) => {
                  step.spend();
                  return finish((result as { message: string }).message);
                })
                .catch(onFail)
                .finally(() => setPending(false));
            }}
          />
        </>
      )}
    </section>
  );
}

export function AccountProfileForm({
  user,
  phone,
  phoneVerified,
  profilePhoto = null,
  telegram = false,
}: {
  user: PublicUser;
  phone: string | null;
  phoneVerified: boolean;
  profilePhoto?: string | null;
  /** Trainer cabinet only. A client and an admin do not attach Telegram here. */
  telegram?: boolean;
}) {
  const router = useRouter();
  const updateProfile = useAuthServerFn(updateProfileFn);
  const updateMail = useAuthServerFn(updateMailPreferenceFn);
  const changePassword = useAuthServerFn(changePasswordFn);
  const requestEmail = useAuthServerFn(requestAccountEmailCodeFn);
  const confirmEmail = useAuthServerFn(confirmAccountEmailCodeFn);
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const step = useContactStepUp();
  const uploadAvatar = useAuthServerFn(setAccountAvatarFn);
  const removeAccount = useAuthServerFn(deleteAccountFn);
  const requestTrainer = useAuthServerFn(requestBecomeTrainerFn);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const canDelete = !isStaff(user.roles);
  const canBecomeTrainer = !hasAnyRole(user.roles, ["trainer", "club", "admin", "superadmin"]);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [email, setEmail] = useState(user.email);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneValue, setPhoneValue] = useState(showPhone(phone));
  const [phoneEditing, setPhoneEditing] = useState(!phone);
  const [phoneCaret, setPhoneCaret] = useState(0);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const liveAvatar = useLiveAvatar(user.id, user.avatarPath);
  const [preview, setPreview] = useState<string | null>(null);
  const avatarUrl = profilePhoto || preview || liveAvatar;
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [mail, setMail] = useState(() => mailFromUser(user));
  const [mailPending, setMailPending] = useState<MailKind | null>(null);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");

  useEffect(() => {
    setMail(mailFromUser(user));
  }, [user.mailMessages, user.mailReviews, user.mailSite, user.mailMarketing]);

  useEffect(() => {
    if (!deleteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletePending) setDeleteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteOpen, deletePending]);

  function ok(message: string) {
    setPopup({ title: "Готово", message });
  }
  function fail(err: unknown) {
    const message = authErrorMessage(err);
    if (!message) return;
    setPopup({ title: "Не получилось", message });
  }

  return (
    <>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          const nextFirst = firstName.trim();
          const nextLast = lastName.trim();
          if (!nextFirst || !nextLast) {
            fail(new Error(nextFirst ? "Укажите фамилию." : "Укажите имя."));
            return;
          }
          setPending(true);
          void updateProfile({ data: { firstName: nextFirst, lastName: nextLast } })
            .then(async () => {
              ok("Имя сохранено.");
              await router.invalidate();
            })
            .catch(fail)
            .finally(() => setPending(false));
        }}
      >
        <div className="cabinet-avatar">
          <UserAvatar name={[firstName, lastName].filter(Boolean).join(" ")} src={avatarUrl} size={72} />
          {profilePhoto ? (
            <p className="cabinet-note">Аватар — моё главное фото из профиля.</p>
          ) : (
            <label className="cabinet-edit">
              Изменить фото
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={avatarBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) setCropFile(file);
                }}
              />
            </label>
          )}
        </div>
        {cropFile ? (
          <AvatarCrop
            file={cropFile}
            pending={pending}
            onCancel={() => setCropFile(null)}
            onSave={(image) => {
              const previous = user.avatarPath;
              flushSync(() => {
                setPreview(image);
                setCropFile(null);
                publishLiveAvatar(user.id, image);
              });
              setAvatarBusy(true);
              void uploadAvatar({ data: { image } })
                .then(async (result) => {
                  const payload =
                    result && typeof result === "object"
                      ? (result as { avatarPath?: string; message?: string })
                      : null;
                  const path = payload && typeof payload.avatarPath === "string" ? payload.avatarPath : "";
                  if (path) {
                    await preloadAvatar(path);
                    publishLiveAvatar(user.id, path);
                    setPreview(null);
                  }
                  ok(payload?.message || "Фото обновлено.");
                })
                .catch((error) => {
                  setPreview(null);
                  publishLiveAvatar(user.id, previous);
                  fail(error);
                })
                .finally(() => {
                  setAvatarBusy(false);
                  void router.invalidate().catch(() => undefined);
                });
            }}
          />
        ) : null}
        <div className="cabinet-form__row">
          <label>
            <span>Имя</span>
            <input
              required
              value={firstName}
              maxLength={100}
              autoComplete="given-name"
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label>
            <span>Фамилия</span>
            <input
              required
              value={lastName}
              maxLength={100}
              autoComplete="family-name"
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
        </div>
        {step.fields}
        <label>
          <span className="cabinet-form__label-row">
            <span>
              Почта
              {" · "}
              {user.emailVerified && email.trim().toLowerCase() === user.email.toLowerCase() ? (
                <em className="cabinet-form__verified">подтверждена</em>
              ) : (
                "не подтверждена"
              )}
            </span>
            {emailEditing ? (
              <button
                type="button"
                className="cabinet-edit"
                onClick={() => {
                  setEmail(user.email);
                  setEmailEditing(false);
                  setEmailSent(false);
                  setEmailCode("");
                }}
              >
                Отмена
              </button>
            ) : (
              <button type="button" className="cabinet-edit" onClick={() => setEmailEditing(true)}>
                Редактировать
              </button>
            )}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            readOnly={!emailEditing}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailSent(false);
            }}
          />
        </label>
        {emailEditing ? (
          <div className="cabinet-form__actions">
            <button
              className="cabinet-form__ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void step.token()
                  .then((stepUpToken) => requestEmail({ data: { email: email.trim(), stepUpToken } }))
                  .then((result) => {
                    step.spend();
                    const payload = result as {
                      message: string;
                      already?: boolean;
                      devCode?: string;
                    };
                    ok(
                      payload.devCode
                        ? `${payload.message} Код: ${payload.devCode}`
                        : payload.message,
                    );
                    setEmailSent(!payload.already);
                    if (payload.already) setEmailEditing(false);
                  })
                  .catch(fail)
                  .finally(() => setPending(false));
              }}
            >
              Подтвердить
            </button>
          </div>
        ) : null}
        {emailEditing && emailSent ? (
          <label>
            <span className="is-required">Код из письма</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={emailCode}
              onChange={(event) => setEmailCode(event.target.value)}
            />
            <div className="cabinet-form__actions">
              <button
                className="cabinet-form__ghost"
                type="button"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void confirmEmail({ data: { email: email.trim(), code: emailCode } })
                    .then(async (result) => {
                      const payload = result as { message: string };
                      ok(payload.message);
                      setEmailSent(false);
                      setEmailCode("");
                      setEmailEditing(false);
                      await router.invalidate();
                    })
                    .catch(fail)
                    .finally(() => setPending(false));
                }}
              >
                Подтвердить код
              </button>
            </div>
          </label>
        ) : null}
        <label>
          <span className="cabinet-form__label-row">
            <span>
              Телефон
              {phone && phoneVerified && !phoneEditing ? (
                <>
                  {" "}
                  · <em className="cabinet-form__verified">подтверждён</em>
                </>
              ) : phone && !phoneEditing ? (
                " · не подтверждён"
              ) : (
                ""
              )}
            </span>
            {phone && !phoneEditing ? (
              <button
                type="button"
                className="cabinet-edit"
                onClick={() => {
                  setPhoneValue(showPhone(phone));
                  setPhoneEditing(true);
                  setPhoneCaret((tick) => tick + 1);
                }}
              >
                Редактировать
              </button>
            ) : phone ? (
              <button
                type="button"
                className="cabinet-edit"
                onClick={() => {
                  setPhoneValue(showPhone(phone));
                  setPhoneEditing(false);
                  setPhoneSent(false);
                  setPhoneCode("");
                }}
              >
                Отмена
              </button>
            ) : null}
          </span>
          <BelarusPhoneInput
            readOnly={!phoneEditing}
            focusCaret={phoneEditing ? phoneCaret : 0}
            value={phoneValue}
            onValue={(next) => {
              setPhoneValue(next);
              setPhoneSent(false);
            }}
          />
        </label>
        {phoneEditing ? (
          <div className="cabinet-form__actions">
            <button
              className="cabinet-form__ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void step.token()
                  .then((stepUpToken) => requestPhone({ data: { phone: phoneValue || BY_PHONE_COUNTRY_PREFIX, stepUpToken } }))
                  .then((result) => {
                    step.spend();
                    const payload = result as {
                      message: string;
                      already?: boolean;
                      devCode?: string;
                    };
                    ok(
                      payload.devCode
                        ? `${payload.message} Код: ${payload.devCode}`
                        : payload.message,
                    );
                    setPhoneSent(!payload.already);
                    if (payload.already) setPhoneEditing(false);
                  })
                  .catch(fail)
                  .finally(() => setPending(false));
              }}
            >
              Подтвердить
            </button>
          </div>
        ) : null}
        {phoneEditing && phoneSent ? (
          <label>
            <span className="is-required">Код из SMS</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={phoneCode}
              onChange={(event) => setPhoneCode(event.target.value)}
            />
            <div className="cabinet-form__actions">
              <button
                className="cabinet-form__ghost"
                type="button"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void confirmPhone({ data: { phone: phoneValue, code: phoneCode } })
                    .then(async (result) => {
                      const payload = result as { message: string };
                      ok(payload.message);
                      setPhoneSent(false);
                      setPhoneCode("");
                      setPhoneEditing(false);
                      await router.invalidate();
                    })
                    .catch(fail)
                    .finally(() => setPending(false));
                }}
              >
                Подтвердить код
              </button>
            </div>
          </label>
        ) : null}
        <label>
          <span>Роль</span>
          <input value={role} readOnly />
        </label>
        <label>
          <span>Статус аккаунта</span>
          <input value={ACCOUNT_STATUS[user.status] ?? user.status} readOnly />
        </label>
        <button className="cabinet-form__submit" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
        {canBecomeTrainer ? (
          <p className="cabinet-note">
            <button type="button" className="cabinet-text-link" onClick={() => setTrainerOpen(true)}>
              Стать тренером
            </button>
          </p>
        ) : null}
      </form>
      {telegram ? <TelegramAccountLink user={user} onOk={ok} onFail={fail} /> : null}
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword !== repeatPassword) {
            fail(new Error("Пароли не совпадают."));
            return;
          }
          setPending(true);
          void changePassword({ data: { currentPassword, newPassword } })
            .then((result) => {
              const payload = result as { message: string };
              ok(payload.message);
              setCurrentPassword("");
              setNewPassword("");
              setRepeatPassword("");
            })
            .catch(fail)
            .finally(() => setPending(false));
        }}
      >
        <label>
          <span>Текущий пароль</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          <span>Новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          <span>Повторите новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
          />
        </label>
        <button className="cabinet-form__submit" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сменить пароль"}
        </button>
        <p className="cabinet-note">
          Нужны минимум 8 символов, цифра и заглавная буква. Эта сессия останется, остальные
          устройства выйдут.
        </p>
      </form>
      <div className="cabinet-form">
        <section className="cabinet-section" id="mail">
          <h3>Письма</h3>
          <p className="cabinet-note">Код, подтверждение почты, сброс пароля и служебные оповещения отключить нельзя.</p>
          {MAIL_ROWS.map((row) => {
            const locked = row.kind === "site";
            const on = locked || mail[row.kind];
            return (
              <div className="mail-pref" key={row.kind}>
                <div>
                  <p className="mail-pref__label">{row.label}</p>
                  <p className="cabinet-note">{row.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-disabled={locked || undefined}
                  aria-label={row.label}
                  className={`mail-switch${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                  disabled={locked || mailPending !== null}
                  onClick={() => {
                    if (locked) return;
                    const next = !on;
                    setMail((current) => ({ ...current, [row.kind]: next }));
                    setMailPending(row.kind);
                    void updateMail({ data: { kind: row.kind, enabled: next } })
                      .then(async () => {
                        await router.invalidate();
                      })
                      .catch((error) => {
                        setMail((current) => ({ ...current, [row.kind]: on }));
                        fail(error);
                      })
                      .finally(() => setMailPending(null));
                  }}
                >
                  <span className="mail-switch__thumb" />
                </button>
              </div>
            );
          })}
        </section>
      </div>
      {canDelete ? (
        <div className="cabinet-form">
          <p className="cabinet-delete">
            <button
              type="button"
              className="cabinet-delete__link"
              onClick={() => {
                setDeleteError("");
                setDeletePassword("");
                setDeleteOpen(true);
              }}
            >
              Удалить аккаунт
            </button>
          </p>
        </div>
      ) : null}
      {deleteOpen ? (
        <div
          className="cabinet-modal"
          onClick={() => {
            if (!deletePending) setDeleteOpen(false);
          }}
        >
          <div
            className="cabinet-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-account-title">Удалить аккаунт</h2>
            <p>
              Аккаунт закроется, и эта сессия закончится. Карточка пропадёт из каталога. Почта, переписка, отзывы, избранное и журнал хранятся шесть месяцев. Войти по этой почте можно снова — мы предложим восстановить аккаунт. Через шесть месяцев данные удаляются без восстановления.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setDeleteError("");
                setDeletePending(true);
                void removeAccount({ data: { password: deletePassword } })
                  .then(() => {
                    window.location.assign("/");
                  })
                  .catch((error: unknown) => {
                    setDeleteError(authErrorMessage(error));
                    setDeletePending(false);
                  });
              }}
            >
              <label>
                <span>Пароль</span>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </label>
              {deleteError ? <p className="cabinet-form__error">{deleteError}</p> : null}
              <div className="cabinet-modal__actions">
                <button type="button" className="cabinet-form__ghost" disabled={deletePending} onClick={() => setDeleteOpen(false)}>
                  Отмена
                </button>
                <button type="submit" disabled={deletePending}>
                  {deletePending ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <AccountSessions />
      {popup ? (
        <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} />
      ) : null}
      {trainerOpen ? (
        <BecomeTrainerDialog
          onSend={(request) => requestTrainer({ data: { request } }) as Promise<{ message: string }>}
          onClose={() => setTrainerOpen(false)}
        />
      ) : null}
    </>
  );
}

function BecomeTrainerDialog({
  onSend,
  onClose,
}: {
  onSend: (request: string) => Promise<{ message: string }>;
  onClose: () => void;
}) {
  const [request, setRequest] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const length = reviewTextLength(request);
  const over = length > BECOME_TRAINER_MAX;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cabinet-modal" onClick={onClose}>
      <div
        className="cabinet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="become-trainer-title"
        onClick={(event) => event.stopPropagation()}
      >
        {sent ? (
          <>
            <h2 id="become-trainer-title">Запрос отправлен</h2>
            <p>{sent}</p>
            <button type="button" onClick={onClose}>Закрыть</button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const text = request.trim();
              if (!text || over) return;
              setPending(true);
              setError("");
              void onSend(text)
                .then((result) => setSent(result.message))
                .catch((err: unknown) => setError(authErrorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            <h2 id="become-trainer-title">Стать тренером</h2>
            <p>Напишите, чем вы занимаетесь. Мы ответим на почту.</p>
            <label>
              <span>Запрос</span>
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                maxLength={4000}
                required
                autoFocus
              />
            </label>
            <p className={over ? "cabinet-form__error" : "cabinet-note"}>{length}/{BECOME_TRAINER_MAX}</p>
            {error ? <p className="cabinet-form__error">{error}</p> : null}
            <div className="cabinet-modal__actions">
              <button type="submit" disabled={pending || !request.trim() || over}>{pending ? "Отправка…" : "Отправить"}</button>
              <button type="button" className="cabinet-form__ghost" onClick={onClose}>Закрыть</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AccountSessions() {
  const router = useRouter();
  const list = useAuthServerFn(listSessionsFn);
  const revoke = useAuthServerFn(revokeSessionFn);
  const [rows, setRows] = useState<Array<{ id: string; createdAt: string; expiresAt: string; ip: string | null; userAgent: string | null; current: boolean }>>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    void list().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <section className="cabinet-form" id="sessions">
      <h3>Сеансы</h3>
      {rows.length === 0 ? <p className="cabinet-note">Открытых сеансов нет.</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="cabinet-form__actions">
          <p className="cabinet-note">
            {row.current ? "Этот сеанс. " : ""}
            {row.ip ?? "без адреса"} · {new Date(row.createdAt).toLocaleString("ru-BY")}
            {row.userAgent ? ` · ${row.userAgent.slice(0, 80)}` : ""}
          </p>
          <button
            className="cabinet-form__ghost"
            type="button"
            onClick={() => {
              void revoke({ data: { sessionId: row.id } })
                .then(async (result) => {
                  if (result.current) {
                    window.location.assign("/auth/login");
                    return;
                  }
                  setRows((current) => current.filter((item) => item.id !== row.id));
                  await router.invalidate();
                })
                .catch((error: unknown) => setNote(authErrorMessage(error)));
            }}
          >
            Завершить
          </button>
        </div>
      ))}
      {note ? <p className="cabinet-form__error">{note}</p> : null}
    </section>
  );
}
