import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { CityEntityInput } from "@/components/city-entity-input";
import { SportEntityInput } from "@/components/sport-entity-input";
import { TrainerMediaField } from "@/components/trainer-media-field";
import {
  addAdminTrainerCertificateFn,
  addAdminTrainerPhotoFn,
  MAX_TRAINER_CERTIFICATES,
  MAX_TRAINER_PHOTOS,
  removeAdminTrainerCertificateFn,
  removeAdminTrainerPhotoFn,
  saveAdminTrainerFn,
  TRAINER_PUBLISH_LABEL,
  TRAINER_PUBLISH_STATUSES,
  type AdminTrainer,
  type AdminTrainerDetail,
  type TrainerPublishStatus,
} from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import type { UserRole } from "@/lib/auth/types";

const TABS = [
  { id: "profile", label: "Профиль" },
  { id: "logins", label: "Входы" },
  { id: "logs", label: "Логи" },
  { id: "facts", label: "Данные" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type Draft = Omit<AdminTrainer, "catalog" | "account">;

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(value: string) {
  return value ? when.format(new Date(value)) : "—";
}

function atLeastOne(raw: string, max: number) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, max);
}

function draftFrom(trainer: AdminTrainer): Draft {
  const { catalog: _catalog, account: _account, ...fields } = trainer;
  return {
    ...fields,
    avatarPath: fields.avatarPath.split("?")[0],
    priceFrom: Math.max(1, trainer.priceFrom ?? 1),
    experienceYears: Math.max(1, trainer.experienceYears || 1),
  };
}

export function AdminTrainerPage({ detail }: { detail: AdminTrainerDetail }) {
  const router = useRouter();
  const save = useAuthServerFn(saveAdminTrainerFn);
  const addPhoto = useAuthServerFn(addAdminTrainerPhotoFn);
  const removePhoto = useAuthServerFn(removeAdminTrainerPhotoFn);
  const addCertificate = useAuthServerFn(addAdminTrainerCertificateFn);
  const removeCertificate = useAuthServerFn(removeAdminTrainerCertificateFn);
  const [tab, setTab] = useState<TabId>("profile");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(detail.trainer));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const { facts } = detail;

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="cabinet-card">
      <h2>{detail.trainer.fullName || detail.trainer.slug}</h2>
      <div className="cabinet-tabs" role="tablist" aria-label="Карточка тренера">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <form
          className="cabinet-form"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            setSaved(null);
            void save({
              data: {
                id: draft.id,
                slug: draft.slug,
                status: draft.status,
                fullName: draft.fullName,
                headline: draft.headline,
                bio: draft.bio,
                about: draft.about,
                sportSlugs: draft.sportSlugs,
                city: draft.city,
                district: draft.district,
                priceFrom: draft.priceFrom,
                phone: draft.phone,
                instagram: draft.instagram,
                telegram: draft.telegram,
                experienceYears: draft.experienceYears,
              },
            })
              .then(() => {
                setSaved("Профиль сохранён.");
                return router.invalidate();
              })
              .catch((err: unknown) => setError(authErrorMessage(err)))
              .finally(() => setPending(false));
          }}
        >
          <TrainerMediaField
            initial={detail.photos}
            max={MAX_TRAINER_PHOTOS}
            addLabel="Загрузить фото"
            doneLabel="Фото загружено"
            onUpload={async (image) => {
              const result = await addPhoto({ data: { slug: draft.slug, image } }) as { photo: string };
              return result.photo;
            }}
            onRemove={async (path) => {
              await removePhoto({ data: { slug: draft.slug, path } });
            }}
          />
          <p className="cabinet-note">До девяти фото. Первое показывается в списке тренеров.</p>
          <label>
            <span>Статус публикации</span>
            <select value={draft.status} onChange={(event) => setField("status", event.target.value as TrainerPublishStatus)}>
              {TRAINER_PUBLISH_STATUSES.map((status) => (
                <option key={status} value={status}>{TRAINER_PUBLISH_LABEL[status]}</option>
              ))}
            </select>
          </label>
          <label><span>Имя и фамилия</span><input value={draft.fullName} maxLength={200} onChange={(event) => setField("fullName", event.target.value)} /></label>
          <label><span>Заголовок</span><input value={draft.headline} maxLength={200} onChange={(event) => setField("headline", event.target.value)} /></label>
          <label><span>О себе</span><textarea value={draft.bio} maxLength={4000} onChange={(event) => setField("bio", event.target.value)} /></label>
          <div className="cabinet-media-block">
            <span className="cabinet-media__label">Сертификаты и дипломы</span>
            <TrainerMediaField
              initial={detail.certificates}
              max={MAX_TRAINER_CERTIFICATES}
              addLabel="Загрузить документ"
              doneLabel="Документ загружен"
              onUpload={async (image) => {
                const result = await addCertificate({ data: { slug: draft.slug, image } }) as { certificate: string };
                return result.certificate;
              }}
              onRemove={async (path) => {
                await removeCertificate({ data: { slug: draft.slug, path } });
              }}
            />
          </div>
          <label><span>О занятиях</span><textarea value={draft.about} maxLength={8000} onChange={(event) => setField("about", event.target.value)} /></label>
          <p className="cabinet-note">Более подробное описание позволит лучше раскрыть вас и собрать отклики.</p>
          <label>
            <span>Виды спорта</span>
            <SportEntityInput value={draft.sportSlugs} onChange={(sportSlugs) => setField("sportSlugs", sportSlugs)} />
          </label>
          <p className="cabinet-note">Не больше четырёх, из категорий второго уровня.</p>
          <label>
            <span>Город</span>
            <CityEntityInput value={draft.city} onChange={(city) => setField("city", city)} />
          </label>
          <p className="cabinet-note">Только населённый пункт Беларуси.</p>
          <label><span>Район</span><input value={draft.district} maxLength={120} onChange={(event) => setField("district", event.target.value)} /></label>
          <label>
            <span>Цена от, BYN</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000}
              step={1}
              value={draft.priceFrom}
              onChange={(event) => setField("priceFrom", atLeastOne(event.target.value, 1_000_000))}
            />
          </label>
          <label><span>Телефон на карточке</span><input value={draft.phone} maxLength={32} onChange={(event) => setField("phone", event.target.value)} /></label>
          <label>
            <span>Instagram</span>
            <div className="cabinet-brand-field">
              <InstagramIcon />
              <input value={draft.instagram} maxLength={300} placeholder="https://instagram.com/…" onChange={(event) => setField("instagram", event.target.value)} />
            </div>
          </label>
          <label>
            <span>Telegram</span>
            <div className="cabinet-brand-field">
              <TelegramIcon />
              <input value={draft.telegram} maxLength={300} placeholder="https://t.me/…" onChange={(event) => setField("telegram", event.target.value)} />
            </div>
          </label>
          <label>
            <span>Общий тренерский стаж, лет</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={80}
              step={1}
              value={draft.experienceYears}
              onChange={(event) => setField("experienceYears", atLeastOne(event.target.value, 80))}
            />
          </label>
          <p className="cabinet-note">
            <a href={`/trainers/${draft.slug}`} target="_blank" rel="noopener noreferrer">Открыть карточку в каталоге</a>
          </p>
          {error ? <p className="cabinet-form__error">{error}</p> : null}
          {saved ? <p className="cabinet-form__ok">{saved}</p> : null}
          <div className="cabinet-form__actions">
            <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button>
            <Link className="cabinet-form__ghost" to="/admin/trainers">К списку</Link>
          </div>
        </form>
      ) : null}
      {tab === "logins" ? (
        detail.logins.length === 0 ? (
          <p className="cabinet-empty">
            {facts.linked ? "Входов пока нет." : "Аккаунт не привязан, поэтому входов нет. Карточка создана отдельно от регистрации."}
          </p>
        ) : (
          <div className="cabinet-table-wrap">
            <table className="cabinet-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Статус</th>
                  <th>IP</th>
                  <th>Устройство</th>
                </tr>
              </thead>
              <tbody>
                {detail.logins.map((login) => (
                  <tr key={login.id}>
                    <td>{formatWhen(login.createdAt)}</td>
                    <td>{login.active ? "Сессия открыта" : "Сессия закрыта"}</td>
                    <td>{login.ip}</td>
                    <td>{login.userAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      {tab === "logs" ? (
        detail.logs.length === 0 ? (
          <p className="cabinet-empty">Событий пока нет.</p>
        ) : (
          <div className="cabinet-table-wrap">
            <table className="cabinet-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Событие</th>
                  <th>Подробности</th>
                </tr>
              </thead>
              <tbody>
                {detail.logs.map((entry, index) => (
                  <tr key={`${entry.at}-${entry.title}-${index}`}>
                    <td>{formatWhen(entry.at)}</td>
                    <td>{entry.title}</td>
                    <td>{entry.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      {tab === "facts" ? (
        <dl className="cabinet-facts">
          <div><dt>Привязка</dt><dd>{facts.linked ? facts.claimStatus : "Аккаунт не привязан"}</dd></div>
          <div><dt>Откуда карточка</dt><dd>{facts.createdSource}</dd></div>
          <div><dt>Instagram</dt><dd>{facts.instagramHandle || "—"}</dd></div>
          <div><dt>Telegram</dt><dd>{facts.telegram || "—"}</dd></div>
          <div><dt>Создана</dt><dd>{formatWhen(facts.createdAt)}</dd></div>
          <div><dt>Изменена</dt><dd>{formatWhen(facts.updatedAt)}</dd></div>
          <div><dt>Забрана</dt><dd>{formatWhen(facts.claimedAt)}</dd></div>
          <div><dt>Аудитория</dt><dd>{facts.audiences || "—"}</dd></div>
          <div><dt>Формат</dt><dd>{facts.formats || "—"}</dd></div>
          <div><dt>Текст из источника</dt><dd>{facts.sourceBio || "—"}</dd></div>
          <div>
            <dt>Закреплённые посты</dt>
            <dd>
              {facts.pinnedPosts.length === 0 ? "—" : facts.pinnedPosts.map((post) => (
                <span key={post.url}>{post.caption || post.url}</span>
              ))}
            </dd>
          </div>
          {facts.linked ? (
            <>
              <div><dt>Имя аккаунта</dt><dd>{facts.accountName || "—"}</dd></div>
              <div><dt>Почта</dt><dd>{facts.accountEmail}</dd></div>
              <div><dt>Телефон аккаунта</dt><dd>{facts.accountPhone || "—"}</dd></div>
              <div><dt>Роли</dt><dd>{facts.accountRoles.split(", ").filter(Boolean).map((role) => ROLE_LABELS[role as UserRole] ?? role).join(", ") || "—"}</dd></div>
              <div><dt>Статус аккаунта</dt><dd>{facts.accountStatus}</dd></div>
              <div><dt>Последний вход</dt><dd>{formatWhen(facts.lastLoginAt)}</dd></div>
            </>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}
