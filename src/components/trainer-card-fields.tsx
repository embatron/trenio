import { useEffect, useState, type ReactNode } from "react";

import { BelarusPhoneInput } from "@/components/belarus-phone-input";
import { PhoneCodeDialogs, usePhoneCodeDialog } from "@/components/phone-code-dialog";
import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { ReviewEditor } from "@/components/review-editor";
import { TrainerPlacesField } from "@/components/trainer-address-field";
import { SportEntityInput } from "@/components/sport-entity-input";
import { TrainerCertificatesField } from "@/components/trainer-certificates-field";
import { TrainerMediaField } from "@/components/trainer-media-field";
import { MAX_TRAINER_PHOTOS } from "@/lib/admin/trainers";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { authErrorMessage } from "@/lib/auth/errors";
import { BY_PHONE_COUNTRY_PREFIX, constrainBelarusPhoneInput } from "@/lib/auth/phone";
import type { TrainerPlace } from "@/lib/geo/schemas";
import {
  TRAINER_AUDIENCE_OPTIONS,
  TRAINER_FORMAT_OPTIONS,
  type TrainerAudience,
  type TrainerFormat,
} from "@/lib/catalog/published-trainers";

export type TrainerCardValues = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  about: string;
  sportSlugs: string[];
  city: string;
  district: string;
  places: TrainerPlace[];
  priceFrom: number | null;
  experienceYears: number;
  instagram: string;
  telegram: string;
  email: string;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
};

type PhoneCodeResult = { message: string; already?: boolean; devCode?: string };

export type TrainerEmailControl = {
  verified: boolean;
  onRequest: (email: string) => Promise<PhoneCodeResult>;
  onConfirm: (email: string, code: string) => Promise<{ message: string }>;
  onVerified: () => void;
};

export type TrainerPhoneControl =
  | { linked: false; value: string; onChange: (value: string) => void; locked?: boolean }
  | {
      linked: true;
      value: string;
      verified: boolean;
      onRequest: (phone: string) => Promise<PhoneCodeResult>;
      onConfirm: (phone: string, code: string) => Promise<{ message: string }>;
      onVerified: () => void;
    };

type MediaHandlers = {
  initial: string[];
  onUpload: (image: string) => Promise<string>;
  onRemove: (path: string) => Promise<void>;
  onReorder?: (paths: string[]) => Promise<void>;
};

type CertificateHandlers = {
  initial: TrainerCertificate[];
  onUpload: (
    file: { name: string; dataUrl: string },
    caption: string,
  ) => Promise<TrainerCertificate>;
  onCaption: (path: string, caption: string) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
};

export const TRAINER_PROFILE_SECTIONS = [
  { id: "trainer-photos", label: "Фото" },
  { id: "trainer-main", label: "Основное" },
  { id: "trainer-docs", label: "Документы" },
  { id: "trainer-work", label: "Тренировки" },
  { id: "trainer-places", label: "Адреса" },
] as const;

function ProfileSection({
  id,
  title,
  tone,
  plain,
  children,
}: {
  id: (typeof TRAINER_PROFILE_SECTIONS)[number]["id"] | "trainer-contacts";
  title: string;
  tone?: "place";
  plain?: boolean;
  children: ReactNode;
}) {
  if (plain) return <>{children}</>;
  return (
    <section
      id={id}
      className={tone ? `cabinet-section cabinet-section--${tone}` : "cabinet-section"}
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`}>{title}</h3>
      {children}
    </section>
  );
}

function optionalYears(raw: string, max: number) {
  if (!raw.trim()) return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 0;
  return Math.min(value, max);
}

function optionalPrice(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 1_000_000);
}

function toggleValue<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function LineMark({ children }: { children: ReactNode }) {
  return (
    <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function PhoneMark() {
  return (
    <LineMark>
      <path d="M8 4h3l1.5 3.5-2 1.2a11 11 0 0 0 4.8 4.8l1.2-2L20 13v3a2 2 0 0 1-2 2A14 14 0 0 1 6 6a2 2 0 0 1 2-2z" />
    </LineMark>
  );
}

function MailMark() {
  return (
    <LineMark>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </LineMark>
  );
}

function ContactControl({ locked, children }: { locked?: boolean; children: ReactNode }) {
  return <div className={locked ? "cabinet-brand-field is-locked" : "cabinet-brand-field"}>{children}</div>;
}

function EmailField({
  email,
  verified,
  onRequest,
  onConfirm,
  onVerified,
}: TrainerEmailControl & { email: string }) {
  const [editing, setEditing] = useState(!email);
  const [value, setValue] = useState(email);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (editing) return;
    setValue(email);
  }, [editing, email]);

  return (
    <div>
      <label>
        <span className="cabinet-form__label-row">
          <span>
            Почта
            {email && verified && !editing ? (
              <>
                {" "}
                · <em className="cabinet-form__verified">подтверждена</em>
              </>
            ) : email && !editing ? (
              " · не подтверждена"
            ) : (
              ""
            )}
          </span>
          {email && !editing ? (
            <button type="button" className="cabinet-edit" onClick={() => setEditing(true)}>
              Редактировать
            </button>
          ) : email ? (
            <button
              type="button"
              className="cabinet-edit"
              onClick={() => {
                setValue(email);
                setEditing(false);
                setSent(false);
                setCode("");
                setStatus("");
              }}
            >
              Отмена
            </button>
          ) : null}
        </span>
        <ContactControl locked={Boolean(email) && !editing}>
          <MailMark />
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            readOnly={Boolean(email) && !editing}
            maxLength={320}
            placeholder="name@example.com"
            value={editing || !email ? value : email}
            onChange={(event) => {
              setValue(event.target.value);
              setSent(false);
            }}
          />
        </ContactControl>
      </label>
      {editing ? (
        <div className="cabinet-form__actions">
          <button
            className="cabinet-form__ghost"
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setStatus("");
              void onRequest(value)
                .then((result) => {
                  setStatus(
                    result.devCode ? `${result.message} Код: ${result.devCode}` : result.message,
                  );
                  setSent(!result.already);
                  if (result.already) {
                    setEditing(false);
                    onVerified();
                  }
                })
                .catch((err: unknown) => setStatus(authErrorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Подтвердить
          </button>
        </div>
      ) : null}
      {editing && sent ? (
        <label>
          <span className="is-required">Код из письма</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="cabinet-form__actions">
            <button
              className="cabinet-form__ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void onConfirm(value, code)
                  .then((result) => {
                    setStatus(result.message);
                    setSent(false);
                    setCode("");
                    setEditing(false);
                    onVerified();
                  })
                  .catch((err: unknown) => setStatus(authErrorMessage(err)))
                  .finally(() => setPending(false));
              }}
            >
              Подтвердить код
            </button>
          </div>
        </label>
      ) : null}
      {status ? (
        <p className="cabinet-note" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function PhoneField({ phone, self }: { phone: TrainerPhoneControl; self: boolean }) {
  const [editing, setEditing] = useState(phone.linked ? !phone.value : false);
  const [phoneCaret, setPhoneCaret] = useState(0);
  const [value, setValue] = useState(
    phone.linked ? constrainBelarusPhoneInput(phone.value || BY_PHONE_COUNTRY_PREFIX) : phone.value,
  );
  useEffect(() => {
    if (!phone.linked || editing) return;
    setValue(constrainBelarusPhoneInput(phone.value));
  }, [editing, phone]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const codeDialog = usePhoneCodeDialog(() => {
    setEditing(false);
    if (phone.linked) phone.onVerified();
  });

  if (!phone.linked) {
    return (
      <label>
        <span>Телефон</span>
        <ContactControl locked={phone.locked}>
          <PhoneMark />
          <BelarusPhoneInput
            value={phone.value || BY_PHONE_COUNTRY_PREFIX}
            readOnly={phone.locked}
            onValue={(next) => phone.onChange(next === BY_PHONE_COUNTRY_PREFIX ? "" : next)}
          />
        </ContactControl>
        <p className="cabinet-note">Подтверждение по SMS появится после привязки аккаунта.</p>
      </label>
    );
  }

  const verified = phone.verified && !editing;

  return (
    <div>
      <label>
        <span className="cabinet-form__label-row">
          <span>
            Телефон
            {phone.value && verified ? (
              <>
                {" "}
                · <em className="cabinet-form__verified">подтверждён</em>
              </>
            ) : phone.value && !editing ? (
              " · не подтверждён"
            ) : (
              ""
            )}
          </span>
          {phone.value && !editing ? (
            <button
              type="button"
              className="cabinet-edit"
              onClick={() => {
                setValue(constrainBelarusPhoneInput(phone.value || BY_PHONE_COUNTRY_PREFIX));
                setEditing(true);
                setPhoneCaret((tick) => tick + 1);
              }}
            >
              Редактировать
            </button>
          ) : phone.value ? (
            <button
              type="button"
              className="cabinet-edit"
              onClick={() => {
                setValue(constrainBelarusPhoneInput(phone.value));
                setEditing(false);
                setStatus("");
              }}
            >
              Отмена
            </button>
          ) : null}
        </span>
        <ContactControl locked={!editing}>
          <PhoneMark />
          <BelarusPhoneInput
            readOnly={!editing}
            focusCaret={editing ? phoneCaret : 0}
            value={
              editing ? value : constrainBelarusPhoneInput(phone.value || BY_PHONE_COUNTRY_PREFIX)
            }
            onValue={(next) => {
              setValue(next);
              codeDialog.reset();
            }}
          />
        </ContactControl>
      </label>
      <p className="cabinet-note">
        {verified
          ? "Номер виден на публичной странице."
          : self
            ? "На публичной странице номер виден только после SMS."
            : "Номер совпадает с телефоном аккаунта и виден на сайте только после SMS."}
      </p>
      {editing ? (
        <div className="cabinet-form__actions">
          <button
            className="cabinet-form__ghost"
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setStatus("");
              void phone
                .onRequest(value || BY_PHONE_COUNTRY_PREFIX)
                .then((result) => {
                  setStatus("");
                  codeDialog.openFromRequest(result);
                })
                .catch((err: unknown) => setStatus(authErrorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Подтвердить
          </button>
        </div>
      ) : null}
      {editing && codeDialog.issued && codeDialog.phase === "closed" ? (
        <div className="cabinet-form__actions">
          <button className="cabinet-form__ghost" type="button" onClick={codeDialog.reopen}>Ввести код</button>
        </div>
      ) : null}
      <PhoneCodeDialogs
        phase={codeDialog.phase}
        code={codeDialog.code}
        error={codeDialog.error}
        pending={codeDialog.pending}
        devCode={codeDialog.devCode}
        doneMessage={codeDialog.doneMessage}
        onCode={codeDialog.setCode}
        onSubmit={() => {
          void codeDialog.submit(() => phone.onConfirm(value, codeDialog.code));
        }}
        onCloseCode={codeDialog.closeCode}
        onCloseDone={codeDialog.closeDone}
      />
      {status ? (
        <p className="cabinet-note" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

export function TrainerCardFields({
  values,
  onChange,
  photos,
  certificates,
  phone,
  emailConfirm,
  leading,
  nick,
  nickFirst = false,
  onNickSupport,
  afterAddress,
  priceLabel = "Цена от, BYN",
  self = false,
  bioInvalid = false,
  telegramVerified = false,
  mode = "full",
}: {
  values: TrainerCardValues;
  onChange: (values: TrainerCardValues) => void;
  photos: MediaHandlers | null;
  certificates: CertificateHandlers | null;
  phone: TrainerPhoneControl;
  emailConfirm?: TrainerEmailControl;
  leading?: ReactNode;
  nick?: string;
  nickFirst?: boolean;
  onNickSupport?: () => void;
  afterAddress?: ReactNode;
  priceLabel?: string;
  self?: boolean;
  bioInvalid?: boolean;
  telegramVerified?: boolean;
  mode?: "full" | "profile" | "contacts";
}) {
  function patch(partial: Partial<TrainerCardValues>) {
    onChange({ ...values, ...partial });
  }
  const showProfile = mode !== "contacts";
  const showContacts = mode !== "profile";
  const nickBlock = nick ? (
    <div>
      <label>
        <span>Ник</span>
        <input
          className="is-locked"
          value={nick}
          readOnly
          required
          aria-readonly="true"
          autoComplete="username"
        />
      </label>
      <p className="cabinet-note">
        Ник совпадает с Instagram: /trainers/{nick}. Сменить его можно только{" "}
        {onNickSupport ? (
          <button type="button" className="cabinet-text-link" onClick={onNickSupport}>
            по запросу в поддержку
          </button>
        ) : (
          "по запросу в поддержку"
        )}
        .
      </p>
    </div>
  ) : null;

  return (
    <>
      {nickFirst ? nickBlock : null}
      {showProfile ? (
      <>
      <ProfileSection id="trainer-photos" title="Фото">
        {photos ? (
          <TrainerMediaField
            initial={photos.initial}
            max={MAX_TRAINER_PHOTOS}
            addLabel="Загрузить фото"
            doneLabel="Фото загружено"
            onUpload={photos.onUpload}
            onRemove={photos.onRemove}
            onReorder={photos.onReorder}
            counter
          />
        ) : (
          <p className="cabinet-note">Фото можно добавить после первого сохранения профиля.</p>
        )}
      </ProfileSection>
      <ProfileSection id="trainer-main" title="Основное">
        {leading}
        {nickFirst ? null : nickBlock}
        {self ? null : (
          <div className="cabinet-form__row">
            <label>
              <span>Имя</span>
              <input
                required
                value={values.firstName}
                maxLength={100}
                autoComplete="given-name"
                onChange={(event) => patch({ firstName: event.target.value })}
              />
            </label>
            <label>
              <span>Фамилия</span>
              <input
                required
                value={values.lastName}
                maxLength={100}
                autoComplete="family-name"
                onChange={(event) => patch({ lastName: event.target.value })}
              />
            </label>
          </div>
        )}
        {self ? (
          <div>
            <span className="cabinet-media__label">Как меня представить</span>
            <ReviewEditor
              value={values.bio}
              onChange={(bio) => patch({ bio })}
              placeholder="Коротко о себе"
              invalid={bioInvalid}
            />
          </div>
        ) : (
          <>
            <label>
              <span>Заголовок</span>
              <input
                value={values.headline}
                maxLength={200}
                placeholder="Тренер по боксу"
                onChange={(event) => patch({ headline: event.target.value })}
              />
            </label>
            <ReviewEditor
              value={values.bio}
              onChange={(bio) => patch({ bio })}
              placeholder="Коротко о себе"
            />
          </>
        )}
      </ProfileSection>
      <ProfileSection id="trainer-docs" title="Документы (диплом, курсы и пр.)">
        {certificates ? (
          <TrainerCertificatesField
            initial={certificates.initial}
            onUpload={certificates.onUpload}
            onCaption={certificates.onCaption}
            onRemove={certificates.onRemove}
          />
        ) : (
          <p className="cabinet-note">Документы можно добавить после первого сохранения профиля.</p>
        )}
      </ProfileSection>
      <ProfileSection id="trainer-work" title="Тренировки">
        <div>
          <span className="cabinet-media__label">Как проходят мои тренировки</span>
          <ReviewEditor
            value={values.about}
            onChange={(about) => patch({ about })}
            placeholder="Как проходят мои тренировки"
          />
        </div>
        <p className="cabinet-note">
          {self
            ? "Как и где проходят мои тренировки и чем они отличаются: место и формат."
            : "Расскажите подробно, как и где проходят тренировки и чем они отличаются: место и формат."}
        </p>
        <label>
          <span>{self ? "Мои виды спорта" : "Виды спорта"}</span>
          <SportEntityInput
            value={values.sportSlugs}
            onChange={(sportSlugs) => patch({ sportSlugs })}
          />
        </label>
        <p className="cabinet-note">Не больше четырёх видов спорта.</p>
        <label>
          <span>{self ? "Мой тренерский стаж, лет" : "Общий тренерский стаж, лет"}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={80}
            step={1}
            value={values.experienceYears >= 1 ? values.experienceYears : ""}
            onChange={(event) => patch({ experienceYears: optionalYears(event.target.value, 80) })}
          />
        </label>
        <label>
          <span>{priceLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000000}
            step={1}
            value={values.priceFrom ?? ""}
            onChange={(event) => patch({ priceFrom: optionalPrice(event.target.value) })}
          />
        </label>
        <p className="cabinet-note">
          Рекомендуем указать минимальную стоимость тренировки: на карточке будет «От N BYN». Если
          сумму не указывать, останется «договорная».
        </p>
        <div>
          <span className="cabinet-media__label">
            {self ? "Формат моих тренировок" : "Формат занятий"}
          </span>
          <div
            className="cabinet-choices"
            role="group"
            aria-label={self ? "Формат моих тренировок" : "Формат занятий"}
          >
            {TRAINER_FORMAT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={values.formats.includes(option.id) ? "is-on" : undefined}
                aria-pressed={values.formats.includes(option.id)}
                onClick={() => patch({ formats: toggleValue(values.formats, option.id) })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="cabinet-media__label">С кем я работаю</span>
          <div className="cabinet-choices" role="group" aria-label="С кем я работаю">
            {TRAINER_AUDIENCE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={values.audiences.includes(option.id) ? "is-on" : undefined}
                aria-pressed={values.audiences.includes(option.id)}
                onClick={() => {
                  const next = toggleValue(values.audiences, option.id);
                  patch({ audiences: next.length > 0 ? next : ["adult"] });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </ProfileSection>
      <ProfileSection id="trainer-places" title="Адреса" tone="place">
        <TrainerPlacesField
          city={values.city}
          places={values.places}
          onChange={(next) => patch(next)}
        />
        {afterAddress}
      </ProfileSection>
      </>
      ) : null}
      {showContacts ? (
      <ProfileSection id="trainer-contacts" title="Контакты" plain={mode === "contacts"}>
        <PhoneField phone={phone} self={self} />
        <label>
          <span>Instagram</span>
          <ContactControl locked={self}>
            <InstagramIcon />
            <input
              value={values.instagram}
              maxLength={300}
              placeholder="https://instagram.com/…"
              readOnly={self}
              aria-readonly={self || undefined}
              className={self ? "is-locked" : undefined}
              onChange={self ? undefined : (event) => patch({ instagram: event.target.value })}
            />
          </ContactControl>
          {self ? (
            <p className="cabinet-note">Ник Instagram менять нельзя. По нему открывается кабинет.</p>
          ) : null}
        </label>
        <label>
          <span>
            Telegram
            {self && values.telegram && telegramVerified ? (
              <>
                {" "}
                · <em className="cabinet-form__verified">подтверждён</em>
              </>
            ) : null}
          </span>
          <ContactControl>
            <TelegramIcon />
            <input
              value={values.telegram}
              maxLength={300}
              placeholder="https://t.me/…"
              onChange={(event) => patch({ telegram: event.target.value })}
            />
          </ContactControl>
          {self ? (
            <p className="cabinet-note">
              {telegramVerified
                ? "Имя видно на публичной странице."
                : "На публичной странице появится после подтверждения ботом."}
            </p>
          ) : null}
        </label>
        {emailConfirm ? (
          <EmailField email={values.email} {...emailConfirm} />
        ) : (
          <label>
            <span>Почта</span>
            <ContactControl>
              <MailMark />
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={values.email}
                maxLength={320}
                placeholder="name@example.com"
                onChange={(event) => patch({ email: event.target.value })}
              />
            </ContactControl>
          </label>
        )}
      </ProfileSection>
      ) : null}
    </>
  );
}
