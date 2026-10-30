import { useEffect, useState, type ReactNode } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { ReviewEditor } from "@/components/review-editor";
import { CityEntityInput } from "@/components/city-entity-input";
import { TrainerPlacesField } from "@/components/trainer-address-field";
import { SportEntityInput } from "@/components/sport-entity-input";
import { TrainerCertificatesField } from "@/components/trainer-certificates-field";
import { TrainerMediaField } from "@/components/trainer-media-field";
import { MAX_TRAINER_PHOTOS } from "@/lib/admin/trainers";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { authErrorMessage } from "@/lib/auth/errors";
import { BY_PHONE_COUNTRY_PREFIX, constrainBelarusPhoneInput, formatBelarusPhone } from "@/lib/auth/phone";
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
  | { linked: false; value: string; onChange: (value: string) => void }
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
  onUpload: (file: { name: string; dataUrl: string }, caption: string) => Promise<TrainerCertificate>;
  onCaption: (path: string, caption: string) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
};

export const TRAINER_PROFILE_SECTIONS = [
  { id: "trainer-photos", label: "Фото" },
  { id: "trainer-main", label: "Основное" },
  { id: "trainer-docs", label: "Документы" },
  { id: "trainer-work", label: "Тренировки" },
  { id: "trainer-places", label: "Адреса" },
  { id: "trainer-contacts", label: "Контакты" },
] as const;

function ProfileSection({
  id,
  title,
  tone,
  children,
}: {
  id: (typeof TRAINER_PROFILE_SECTIONS)[number]["id"];
  title: string;
  tone?: "place" | "contact";
  children: ReactNode;
}) {
  return (
    <section id={id} className={tone ? `cabinet-section cabinet-section--${tone}` : "cabinet-section"} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{title}</h3>
      {children}
    </section>
  );
}

function atLeastOne(raw: string, max: number) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
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

function EmailField({ email, verified, onRequest, onConfirm, onVerified }: TrainerEmailControl & { email: string }) {
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
            {email && verified && !editing ? <> · <em className="cabinet-form__verified">подтверждена</em></> : email && !editing ? " · не подтверждена" : ""}
          </span>
          {email && !editing ? (
            <button type="button" className="cabinet-edit" onClick={() => setEditing(true)}>Редактировать</button>
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
                  setStatus(result.devCode ? `${result.message} Код: ${result.devCode}` : result.message);
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
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} />
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
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </div>
  );
}

function PhoneField({ phone, self }: { phone: TrainerPhoneControl; self: boolean }) {
  const [editing, setEditing] = useState(phone.linked ? !phone.value : false);
  const [value, setValue] = useState(phone.linked ? constrainBelarusPhoneInput(phone.value) : phone.value);
  useEffect(() => {
    if (!phone.linked || editing) return;
    setValue(constrainBelarusPhoneInput(phone.value));
  }, [editing, phone]);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  if (!phone.linked) {
    return (
      <label>
        <span>Телефон</span>
        <input
          value={phone.value ? formatBelarusPhone(phone.value) || phone.value : ""}
          maxLength={32}
          inputMode="tel"
          placeholder="+375 29 123-45-67"
          onChange={(event) => {
            const next = event.target.value.trim();
            phone.onChange(next ? constrainBelarusPhoneInput(next) : "");
          }}
        />
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
            {phone.value && verified ? <> · <em className="cabinet-form__verified">подтверждён</em></> : phone.value && !editing ? " · не подтверждён" : ""}
          </span>
          {phone.value && !editing ? (
            <button type="button" className="cabinet-edit" onClick={() => setEditing(true)}>Редактировать</button>
          ) : phone.value ? (
            <button
              type="button"
              className="cabinet-edit"
              onClick={() => {
                setValue(constrainBelarusPhoneInput(phone.value));
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
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          readOnly={!editing}
          placeholder={BY_PHONE_COUNTRY_PREFIX}
          value={editing ? value : constrainBelarusPhoneInput(phone.value)}
          onChange={(event) => {
            setValue(constrainBelarusPhoneInput(event.target.value));
            setSent(false);
          }}
        />
      </label>
      <p className="cabinet-note">{self ? "На публичной странице номер виден только после SMS." : "Номер совпадает с телефоном аккаунта и виден на сайте только после SMS."}</p>
      {editing ? (
        <div className="cabinet-form__actions">
          <button
            className="cabinet-form__ghost"
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setStatus("");
              void phone.onRequest(value || BY_PHONE_COUNTRY_PREFIX)
                .then((result) => {
                  setStatus(result.devCode ? `${result.message} Код: ${result.devCode}` : result.message);
                  setSent(!result.already);
                  if (result.already) {
                    setEditing(false);
                    phone.onVerified();
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
          <span className="is-required">Код из SMS</span>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} />
          <div className="cabinet-form__actions">
            <button
              className="cabinet-form__ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void phone.onConfirm(value, code)
                  .then((result) => {
                    setStatus(result.message);
                    setSent(false);
                    setCode("");
                    setEditing(false);
                    phone.onVerified();
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
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
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
  afterAddress,
  priceLabel = "Цена от, BYN",
  self = false,
  bioInvalid = false,
}: {
  values: TrainerCardValues;
  onChange: (values: TrainerCardValues) => void;
  photos: MediaHandlers | null;
  certificates: CertificateHandlers | null;
  phone: TrainerPhoneControl;
  emailConfirm?: TrainerEmailControl;
  leading?: ReactNode;
  nick?: string;
  afterAddress?: ReactNode;
  priceLabel?: string;
  self?: boolean;
  bioInvalid?: boolean;
}) {
  function patch(partial: Partial<TrainerCardValues>) {
    onChange({ ...values, ...partial });
  }

  return (
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
        {self && photos ? <p className="cabinet-note">Первое фото — мой аватар.</p> : null}
      </ProfileSection>
      <ProfileSection id="trainer-main" title="Основное">
        {leading}
        {nick ? (
          <label>
            <span>Ник</span>
            <input className="is-locked" value={nick} readOnly required aria-readonly="true" autoComplete="username" />
            <p className="cabinet-note">Ник совпадает с Instagram: /trainers/{nick}. Сменить его можно только по запросу в поддержку.</p>
          </label>
        ) : null}
        {self ? null : (
          <div className="cabinet-form__row">
            <label>
              <span>Имя</span>
              <input required value={values.firstName} maxLength={100} autoComplete="given-name" onChange={(event) => patch({ firstName: event.target.value })} />
            </label>
            <label>
              <span>Фамилия</span>
              <input required value={values.lastName} maxLength={100} autoComplete="family-name" onChange={(event) => patch({ lastName: event.target.value })} />
            </label>
          </div>
        )}
        {self ? (
          <div>
            <span className="cabinet-media__label">Как меня представить</span>
            <ReviewEditor value={values.bio} onChange={(bio) => patch({ bio })} placeholder="Коротко о себе" invalid={bioInvalid} />
          </div>
        ) : (
          <>
            <label>
              <span>Заголовок</span>
              <input value={values.headline} maxLength={200} placeholder="Тренер по боксу" onChange={(event) => patch({ headline: event.target.value })} />
            </label>
            <ReviewEditor value={values.bio} onChange={(bio) => patch({ bio })} placeholder="Коротко о себе" />
          </>
        )}
      </ProfileSection>
      <ProfileSection id="trainer-docs" title="Документы">
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
          <ReviewEditor value={values.about} onChange={(about) => patch({ about })} placeholder="Как проходят мои тренировки" />
        </div>
        <p className="cabinet-note">{self ? "Как и где проходят мои тренировки и чем они отличаются: место и формат." : "Расскажите подробно, как и где проходят тренировки и чем они отличаются: место и формат."}</p>
        <label>
          <span>{self ? "Мои виды спорта" : "Виды спорта"}</span>
          <SportEntityInput value={values.sportSlugs} onChange={(sportSlugs) => patch({ sportSlugs })} />
        </label>
        <p className="cabinet-note">Не больше четырёх, из категорий второго уровня.</p>
        <label>
          <span>{self ? "Мой тренерский стаж, лет" : "Общий тренерский стаж, лет"}</span>
          <input
            type="number"
            required
            inputMode="numeric"
            min={1}
            max={80}
            step={1}
            value={values.experienceYears}
            onChange={(event) => patch({ experienceYears: atLeastOne(event.target.value, 80) })}
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
        <p className="cabinet-note">Рекомендуем указать минимальную стоимость тренировки: на карточке будет «От N BYN». Если сумму не указывать, останется «договорная».</p>
        <div>
          <span className="cabinet-media__label">{self ? "Формат моих тренировок" : "Формат занятий"}</span>
          <div className="cabinet-choices" role="group" aria-label={self ? "Формат моих тренировок" : "Формат занятий"}>
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
          <span className="cabinet-media__label">{self ? "С кем я работаю" : "С кем работает"}</span>
          <div className="cabinet-choices" role="group" aria-label={self ? "С кем я работаю" : "С кем работает"}>
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
        <label>
          <span>{self ? "Город, где я тренирую" : "Город"}</span>
          <CityEntityInput value={values.city} onChange={(city) => patch({ city })} />
        </label>
        <p className="cabinet-note">Только населённый пункт Беларуси.</p>
        <TrainerPlacesField places={values.places} onChange={(places) => patch({ places })} />
        {afterAddress}
      </ProfileSection>
      <ProfileSection id="trainer-contacts" title="Контакты" tone="contact">
        <PhoneField phone={phone} self={self} />
        <label>
          <span>Instagram</span>
          <div className="cabinet-brand-field">
            <InstagramIcon />
            <input value={values.instagram} maxLength={300} placeholder="https://instagram.com/…" onChange={(event) => patch({ instagram: event.target.value })} />
          </div>
          {self ? <p className="cabinet-note">Ссылка видна на публичной странице.</p> : null}
        </label>
        <label>
          <span>Telegram</span>
          <div className="cabinet-brand-field">
            <TelegramIcon />
            <input value={values.telegram} maxLength={300} placeholder="https://t.me/…" onChange={(event) => patch({ telegram: event.target.value })} />
          </div>
          {self ? <p className="cabinet-note">На публичной странице появится после подтверждения ботом.</p> : null}
        </label>
        {emailConfirm ? (
          <EmailField email={values.email} {...emailConfirm} />
        ) : (
          <label>
            <span>Почта</span>
            <input type="email" inputMode="email" autoComplete="off" value={values.email} maxLength={320} placeholder="name@example.com" onChange={(event) => patch({ email: event.target.value })} />
          </label>
        )}
      </ProfileSection>
    </>
  );
}
