import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { useContactStepUp } from "@/components/auth/step-up-fields";
import { AvatarCrop } from "@/components/avatar-crop";
import { BelarusPhoneInput } from "@/components/belarus-phone-input";
import { CabinetModal, CabinetNotice } from "@/components/cabinet";
import { UserAvatar } from "@/components/user-avatar";
import { constrainBelarusPhoneInput, BY_PHONE_COUNTRY_PREFIX } from "@/lib/auth/phone";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  changePasswordFn,
  confirmAccountEmailCodeFn,
  confirmAccountPhoneCodeFn,
  deleteAccountFn,
  listSessionsFn,
  requestAccountEmailCodeFn,
  requestAccountPhoneCodeFn,
  revokeSessionFn,
  setAccountAvatarFn,
  updateMailPreferenceFn,
  updateProfileFn,
} from "@/lib/auth/functions";
import type { MailKind } from "@/lib/mail/kinds";
import { publishLiveAvatar, useLiveAvatar } from "@/lib/auth/live-avatar";
import { variantImagePath } from "@/lib/images/variants";
import { hasAnyRole, isStaff, ROLE_LABELS } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/schemas";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { setPushMessagesFn, getPushPublicKeyFn, savePushSubscriptionFn } from "@/lib/messages/push-functions";
import { canUsePush, clearPushAsked, disableDevicePush, enableDevicePush } from "@/lib/messages/push-client";

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

export function AccountProfileForm({
  user,
  phone,
  phoneVerified,
  profilePhoto = null,
}: {
  user: PublicUser;
  phone: string | null;
  phoneVerified: boolean;
  profilePhoto?: string | null;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const canDelete = !isStaff(user.roles);
  const canBecomeTrainer = !hasAnyRole(user.roles, ["trainer", "club", "admin", "superadmin"]);
  const surnameOptional = hasAnyRole(user.roles, ["trainer", "club"]);
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
  const setPushPref = useAuthServerFn(setPushMessagesFn);
  const loadPushKey = useAuthServerFn(getPushPublicKeyFn);
  const savePush = useAuthServerFn(savePushSubscriptionFn);
  const [pushOn, setPushOn] = useState(user.pushMessages);
  const [pushPending, setPushPending] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");

  useEffect(() => {
    setMail(mailFromUser(user));
  }, [user.mailMessages, user.mailReviews, user.mailSite, user.mailMarketing]);

  useEffect(() => {
    setPushOn(user.pushMessages);
  }, [user.pushMessages]);

  useEffect(() => {
    if (!canUsePush()) return;
    setPushDenied(Notification.permission === "denied");
  }, [pushOn]);

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
          if (!nextFirst || (!surnameOptional && !nextLast)) {
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
            <span>{surnameOptional ? "Фамилия, необязательно" : "Фамилия"}</span>
            <input
              required={!surnameOptional}
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
            <Link to="/join/trainer" className="cabinet-text-link">Стать тренером</Link>
          </p>
        ) : null}
      </form>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword !== repeatPassword) {
            fail(new Error("Пароли не совпадают."));
            return;
          }
          setPending(true);
          void changePassword({ data: { currentPassword: user.hasPassword ? currentPassword : "", newPassword } })
            .then(async (result) => {
              const payload = result as { message: string };
              ok(payload.message);
              setCurrentPassword("");
              setNewPassword("");
              setRepeatPassword("");
              await router.invalidate();
            })
            .catch(fail)
            .finally(() => setPending(false));
        }}
      >
        {user.hasPassword ? (
          <label>
            <span>Текущий пароль</span>
            <input
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
        ) : (
          <p className="cabinet-note">
            Пароль для входа по почте ещё не задан. Сохраните новый — текущий спрашивать не будем. Следующая смена уже попросит его.
          </p>
        )}
        <label>
          <span>Новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
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
            maxLength={128}
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
          />
        </label>
        <button className="cabinet-form__submit" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : user.hasPassword ? "Сменить пароль" : "Задать пароль"}
        </button>
        <p className="cabinet-note">
          Нужны минимум 8 символов. Слишком известный пароль не подойдёт. Эта сессия останется, остальные
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
        <section className="cabinet-section" id="notices">
          <h3>Уведомления</h3>
          <div className="mail-pref">
            <div>
              <p className="mail-pref__label">В браузере</p>
              <p className="cabinet-note">
                Сообщение в уведомлениях, когда вам написали — на компьютере и на телефоне.
                Включено, пока не выключите здесь.
              </p>
              {pushDenied && pushOn ? (
                <p className="cabinet-note">
                  Браузер запретил уведомления. Разрешите их в его настройках.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushOn}
              aria-label="В браузере"
              className={`mail-switch${pushOn ? " is-on" : ""}`}
              disabled={pushPending}
              onClick={() => {
                const next = !pushOn;
                setPushOn(next);
                setPushPending(true);
                clearPushAsked();
                const permissionAsk = next && canUsePush() && Notification.permission === "default"
                  ? Notification.requestPermission()
                  : Promise.resolve<NotificationPermission>(
                    next && canUsePush() ? Notification.permission : "default",
                  );
                void Promise.all([setPushPref({ data: { enabled: next } }), permissionAsk])
                  .then(async ([, permission]) => {
                    if (next && canUsePush()) {
                      setPushDenied(permission === "denied");
                      if (permission === "granted") {
                        const result = await loadPushKey();
                        if (result.publicKey) await enableDevicePush(result.publicKey, savePush);
                      }
                    } else if (!next) {
                      void disableDevicePush();
                    }
                    await router.invalidate();
                  })
                  .catch((error) => {
                    setPushOn(!next);
                    fail(error);
                  })
                  .finally(() => setPushPending(false));
              }}
            >
              <span className="mail-switch__thumb" />
            </button>
          </div>
        </section>
      </div>
      {deleteOpen ? (
        <CabinetModal
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
              Аккаунт закроется, и эта сессия закончится. Карточка пропадёт из каталога. Почта, переписка, отзывы и избранное хранятся шесть месяцев. Журнал остаётся. Войти по этой почте можно снова — мы предложим восстановить аккаунт. Через шесть месяцев данные аккаунта удаляются без восстановления.
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
              {user.hasPassword ? (
                <label>
                  <span>Пароль</span>
                  <input
                    type="password"
                    required
                    autoFocus
                    maxLength={128}
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                </label>
              ) : null}
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
        </CabinetModal>
      ) : null}
      <AccountSessions />
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
      {popup ? (
        <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} />
      ) : null}
    </>
  );
}

function sessionFace(userAgent: string | null): { browser: string; device: string } {
  const ua = userAgent ?? "";
  const browser = /YaBrowser/i.test(ua)
    ? "Яндекс"
    : /Edg\//i.test(ua)
      ? "Edge"
      : /OPR\/|Opera/i.test(ua)
        ? "Opera"
        : /SamsungBrowser/i.test(ua)
          ? "Samsung"
          : /FxiOS|Firefox\//i.test(ua)
            ? "Firefox"
            : /CriOS|Chrome\//i.test(ua)
              ? "Chrome"
              : /Safari\//i.test(ua)
                ? "Safari"
                : "Браузер";
  const device = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "Mac"
          : /Windows/i.test(ua)
            ? "Windows"
            : /CrOS/i.test(ua)
              ? "Chromebook"
              : /Linux/i.test(ua)
                ? "Linux"
                : "Устройство";
  return { browser, device };
}

function loginWhen(iso: string) {
  return new Date(iso).toLocaleString("ru-BY", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    <details className="cabinet-form cabinet-sessions" id="sessions">
      <summary>
        Сеансы
        <svg className="cabinet-sessions__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      {rows.length === 0 ? <p className="cabinet-note">Открытых сеансов нет.</p> : null}
      {rows.map((row) => {
        const face = sessionFace(row.userAgent);
        return (
          <div key={row.id} className="cabinet-session">
            <div>
              <p className="cabinet-session__face">
                {face.browser} · {face.device}
              </p>
              <p className="cabinet-note">
                {row.current ? "Этот сеанс. " : ""}
                Вход {loginWhen(row.createdAt)}
              </p>
            </div>
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
        );
      })}
      {note ? <p className="cabinet-form__error">{note}</p> : null}
    </details>
  );
}
