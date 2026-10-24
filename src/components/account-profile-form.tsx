import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetNotice } from "@/components/cabinet";
import { PhotoImage } from "@/components/photo-image";
import { UserAvatar } from "@/components/user-avatar";
import { constrainBelarusPhoneInput, BY_PHONE_COUNTRY_PREFIX } from "@/lib/auth/phone";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  changePasswordFn,
  confirmAccountEmailCodeFn,
  confirmAccountPhoneCodeFn,
  requestAccountEmailCodeFn,
  requestAccountPhoneCodeFn,
  setAccountAvatarFn,
  updateProfileFn,
} from "@/lib/auth/functions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/schemas";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const ACCOUNT_STATUS: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

function showPhone(phone: string | null) {
  if (!phone) return "";
  return constrainBelarusPhoneInput(phone);
}

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      img.src = url;
    });
    const max = 512;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать изображение.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AccountProfileForm({
  user,
  phone,
  phoneVerified,
}: {
  user: PublicUser;
  phone: string | null;
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const updateProfile = useAuthServerFn(updateProfileFn);
  const changePassword = useAuthServerFn(changePasswordFn);
  const requestEmail = useAuthServerFn(requestAccountEmailCodeFn);
  const confirmEmail = useAuthServerFn(confirmAccountEmailCodeFn);
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const uploadAvatar = useAuthServerFn(setAccountAvatarFn);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [email, setEmail] = useState(user.email);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneValue, setPhoneValue] = useState(showPhone(phone));
  const [phoneEditing, setPhoneEditing] = useState(!phone);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarPath);
  const [pending, setPending] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  const role = user.roles.map((item) => ROLE_LABELS[item]).join(", ");

  function ok(message: string) {
    setPopup({ title: "Готово", message });
  }
  function fail(err: unknown) {
    setPopup({ title: "Не получилось", message: authErrorMessage(err) });
  }

  return (
    <>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          const nextFirst = firstName.trim();
          const nextLast = lastName.trim();
          if (!nextFirst) {
            fail(new Error("Укажите имя."));
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
          {avatarUrl ? <PhotoImage className="cabinet-avatar__photo" src={avatarUrl} alt="" preset="avatar" width={72} height={72} /> : <UserAvatar name={[firstName, lastName].filter(Boolean).join(" ")} size={72} />}
          <label className="cabinet-edit">
            Изменить фото
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setPending(true);
                void fileToJpeg(file)
                  .then((image) => uploadAvatar({ data: { image } }))
                  .then(async (result) => {
                    const payload = result as { avatarPath: string; message: string };
                    setAvatarUrl(payload.avatarPath);
                    ok(payload.message);
                    await router.invalidate();
                  })
                  .catch(fail)
                  .finally(() => setPending(false));
              }}
            />
          </label>
        </div>
        <div className="cabinet-form__row">
          <label>
            <span>Имя</span>
            <input required value={firstName} maxLength={100} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label>
            <span>Фамилия</span>
            <input value={lastName} maxLength={100} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} />
          </label>
        </div>
        <label>
          <span className="cabinet-form__label-row">
            <span>
              Почта
              {" · "}
              {user.emailVerified && email.trim().toLowerCase() === user.email.toLowerCase() ? <em className="cabinet-form__verified">подтверждена</em> : "не подтверждена"}
            </span>
            {emailEditing ? (
              <button type="button" className="cabinet-edit" onClick={() => { setEmail(user.email); setEmailEditing(false); setEmailSent(false); setEmailCode(""); }}>Отмена</button>
            ) : (
              <button type="button" className="cabinet-edit" onClick={() => setEmailEditing(true)}>Редактировать</button>
            )}
          </span>
          <input type="email" required autoComplete="email" readOnly={!emailEditing} value={email} onChange={(event) => { setEmail(event.target.value); setEmailSent(false); }} />
        </label>
        {emailEditing ? (
          <div className="cabinet-form__actions">
            <button
              className="cabinet-form__ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void requestEmail({ data: { email: email.trim() } })
                  .then((result) => {
                    const payload = result as { message: string; already?: boolean; devCode?: string };
                    ok(payload.devCode ? `${payload.message} Код: ${payload.devCode}` : payload.message);
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
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
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
              {phone && phoneVerified && !phoneEditing ? <> · <em className="cabinet-form__verified">подтверждён</em></> : phone && !phoneEditing ? " · не подтверждён" : ""}
            </span>
            {phone && !phoneEditing ? (
              <button type="button" className="cabinet-edit" onClick={() => setPhoneEditing(true)}>Редактировать</button>
            ) : phone ? (
              <button type="button" className="cabinet-edit" onClick={() => { setPhoneValue(showPhone(phone)); setPhoneEditing(false); setPhoneSent(false); setPhoneCode(""); }}>Отмена</button>
            ) : null}
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            readOnly={!phoneEditing}
            placeholder={BY_PHONE_COUNTRY_PREFIX}
            value={phoneValue}
            onChange={(event) => { setPhoneValue(constrainBelarusPhoneInput(event.target.value)); setPhoneSent(false); }}
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
                void requestPhone({ data: { phone: phoneValue || BY_PHONE_COUNTRY_PREFIX } })
                  .then((result) => {
                    const payload = result as { message: string; already?: boolean; devCode?: string };
                    ok(payload.devCode ? `${payload.message} Код: ${payload.devCode}` : payload.message);
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
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
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
        <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button>
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
          <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label>
          <span>Новый пароль</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label>
          <span>Повторите новый пароль</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} />
        </label>
        <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сменить пароль"}</button>
        <p className="cabinet-note">Нужны минимум 8 символов, цифра и заглавная буква. Эта сессия останется, остальные устройства выйдут.</p>
      </form>
      {popup ? <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} /> : null}
    </>
  );
}
