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
  priceFrom: number;
  experienceYears: number;
  instagram: string;
  telegram: string;
  email: string;
  formats: TrainerFormat[];
  audiences: TrainerAudience[];
};

type PhoneCodeResult = { message: string; already?: boolean; devCode?: string };

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

function atLeastOne(raw: string, max: number) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, max);
}

function toggleValue<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function PhoneField({ phone }: { phone: TrainerPhoneControl }) {
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
      <p className="cabinet-note">Номер совпадает с телефоном аккаунта.</p>
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
  leading,
  nick,
  afterAddress,
  priceLabel = "Цена от, BYN",
}: {
  values: TrainerCardValues;
  onChange: (values: TrainerCardValues) => void;
  photos: MediaHandlers | null;
  certificates: CertificateHandlers | null;
  phone: TrainerPhoneControl;
  leading?: ReactNode;
  nick?: string;
  afterAddress?: ReactNode;
  priceLabel?: string;
}) {
  function patch(partial: Partial<TrainerCardValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <>
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
      {leading}
      {nick ? (
        <label>
          <span>Ник</span>
          <input className="is-locked" value={nick} readOnly required aria-readonly="true" autoComplete="username" />
          <p className="cabinet-note">Ник совпадает с Instagram: /trainers/{nick}. Сменить его можно только по запросу в поддержку.</p>
        </label>
      ) : null}
      <div className="cabinet-form__row">
        <label>
          <span>Имя</span>
          <input required value={values.firstName} maxLength={100} autoComplete="given-name" onChange={(event) => patch({ firstName: event.target.value })} />
        </label>
        <label>
          <span>Фамилия</span>
          <input value={values.lastName} maxLength={100} autoComplete="family-name" onChange={(event) => patch({ lastName: event.target.value })} />
        </label>
      </div>
      <label>
        <span>Заголовок</span>
        <input value={values.headline} maxLength={200} placeholder="Тренер по боксу" onChange={(event) => patch({ headline: event.target.value })} />
      </label>
      <div>
        <span className="cabinet-media__label">О себе</span>
        <ReviewEditor value={values.bio} onChange={(bio) => patch({ bio })} placeholder="Коротко о себе" />
      </div>
      <div className="cabinet-media-block">
        <span className="cabinet-media__label">Сертификаты и дипломы</span>
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
      </div>
      <div>
        <span className="cabinet-media__label">О занятиях</span>
        <ReviewEditor value={values.about} onChange={(about) => patch({ about })} placeholder="Как проходят занятия" />
      </div>
      <p className="cabinet-note">Расскажите подробно, как и где проходят занятия с вами и в каком виде: место, формат и чем они отличаются.</p>
      <label>
        <span>Виды спорта</span>
        <SportEntityInput value={values.sportSlugs} onChange={(sportSlugs) => patch({ sportSlugs })} />
      </label>
      <p className="cabinet-note">Не больше четырёх, из категорий второго уровня.</p>
      <label>
        <span>Общий тренерский стаж, лет</span>
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
        <span>Город</span>
        <CityEntityInput value={values.city} onChange={(city) => patch({ city })} />
      </label>
      <p className="cabinet-note">Только населённый пункт Беларуси.</p>
      <TrainerPlacesField places={values.places} onChange={(places) => patch({ places })} />
      {afterAddress}
      <label>
        <span>{priceLabel}</span>
        <input
          type="number"
          required
          inputMode="numeric"
          min={1}
          max={1000000}
          step={1}
          value={values.priceFrom}
          onChange={(event) => patch({ priceFrom: atLeastOne(event.target.value, 1_000_000) })}
        />
      </label>
      <div>
        <span className="cabinet-media__label">Формат занятий</span>
        <div className="cabinet-choices" role="group" aria-label="Формат занятий">
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
        <span className="cabinet-media__label">С кем работает</span>
        <div className="cabinet-choices" role="group" aria-label="С кем работает">
          {TRAINER_AUDIENCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={values.audiences.includes(option.id) ? "is-on" : undefined}
              aria-pressed={values.audiences.includes(option.id)}
              onClick={() => patch({ audiences: toggleValue(values.audiences, option.id) })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <PhoneField phone={phone} />
      <label>
        <span>Instagram</span>
        <div className="cabinet-brand-field">
          <InstagramIcon />
          <input value={values.instagram} maxLength={300} placeholder="https://instagram.com/…" onChange={(event) => patch({ instagram: event.target.value })} />
        </div>
      </label>
      <label>
        <span>Telegram</span>
        <div className="cabinet-brand-field">
          <TelegramIcon />
          <input value={values.telegram} maxLength={300} placeholder="https://t.me/…" onChange={(event) => patch({ telegram: event.target.value })} />
        </div>
      </label>
      <label>
        <span>Почта</span>
        <input type="email" inputMode="email" autoComplete="off" value={values.email} maxLength={320} placeholder="name@example.com" onChange={(event) => patch({ email: event.target.value })} />
        <p className="cabinet-note">Контакт из профиля. Без подтверждения и без входа в аккаунт.</p>
      </label>
    </>
  );
}
