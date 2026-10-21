import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AdminClaimLink } from "@/components/admin-trainers-table";
import { TablePager, useTablePage } from "@/components/table-pager";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import {
  addAdminTrainerCertificateFn,
  updateAdminTrainerCertificateFn,
  addAdminTrainerPhotoFn,
  confirmAdminTrainerPhoneCodeFn,
  removeAdminTrainerCertificateFn,
  removeAdminTrainerPhotoFn,
  reorderAdminTrainerPhotosFn,
  requestAdminTrainerPhoneCodeFn,
  saveAdminTrainerFn,
  TRAINER_PUBLISH_LABEL,
  TRAINER_PUBLISH_STATUSES,
  type AdminTrainer,
  type AdminTrainerDetail,
  type TrainerPublishStatus,
} from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
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
  const reorderPhotos = useAuthServerFn(reorderAdminTrainerPhotosFn);
  const addCertificate = useAuthServerFn(addAdminTrainerCertificateFn);
  const updateCertificate = useAuthServerFn(updateAdminTrainerCertificateFn);
  const removeCertificate = useAuthServerFn(removeAdminTrainerCertificateFn);
  const requestPhone = useAuthServerFn(requestAdminTrainerPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAdminTrainerPhoneCodeFn);
  const [tab, setTab] = useState<TabId>("profile");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(detail.trainer));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const { facts } = detail;
  const logins = useTablePage(detail.logins);
  const logs = useTablePage(detail.logs);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="cabinet-card">
      <h2>{detail.trainer.fullName || detail.trainer.slug}</h2>
      <p className="cabinet-gender">Род: {facts.gender}</p>
      {detail.trainer.claimOpen ? (
        <div className="cabinet-claim-bar">
          <AdminClaimLink origin={detail.origin} trainer={detail.trainer} />
        </div>
      ) : null}
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
                email: draft.email,
                experienceYears: draft.experienceYears,
                formats: draft.formats,
                audiences: draft.audiences,
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
          <TrainerCardFields
            nick={draft.slug}
            values={draft}
            onChange={(values: TrainerCardValues) => setDraft((current) => ({ ...current, ...values }))}
            photos={{
              initial: detail.photos,
              onUpload: async (image) => {
                const result = await addPhoto({ data: { slug: draft.slug, image } }) as { photo: string };
                return result.photo;
              },
              onRemove: async (path) => {
                await removePhoto({ data: { slug: draft.slug, path } });
              },
              onReorder: async (paths) => {
                await reorderPhotos({ data: { slug: draft.slug, paths } });
              },
            }}
            certificates={{
              initial: detail.certificates,
              onUpload: async (file, caption) => {
                const result = await addCertificate({ data: { slug: draft.slug, fileName: file.name, caption, dataUrl: file.dataUrl } }) as { certificate: TrainerCertificate };
                return result.certificate;
              },
              onCaption: async (path, caption) => {
                await updateCertificate({ data: { slug: draft.slug, path, caption } });
              },
              onRemove: async (path) => {
                await removeCertificate({ data: { slug: draft.slug, path } });
              },
            }}
            phone={detail.trainer.account ? {
              linked: true,
              value: detail.trainer.account.phone || draft.phone,
              verified: detail.trainer.account.phoneVerified,
              onRequest: async (phone) => (await requestPhone({ data: { slug: draft.slug, phone } })) as { message: string; already?: boolean; devCode?: string },
              onConfirm: async (phone, code) => (await confirmPhone({ data: { slug: draft.slug, phone, code } })) as { message: string },
              onVerified: () => {
                void router.invalidate();
              },
            } : {
              linked: false,
              value: draft.phone,
              onChange: (phone) => setField("phone", phone),
            }}
            leading={(
              <label>
                <span>Статус публикации</span>
                <select value={draft.status} onChange={(event) => setField("status", event.target.value as TrainerPublishStatus)}>
                  {TRAINER_PUBLISH_STATUSES.map((status) => (
                    <option key={status} value={status}>{TRAINER_PUBLISH_LABEL[status]}</option>
                  ))}
                </select>
              </label>
            )}
          />
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
          <>
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
                {logins.rows.map((login) => (
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
          <TablePager page={logins.page} pages={logins.pages} total={logins.total} from={logins.from} to={logins.to} onPage={logins.setPage} />
          </>
        )
      ) : null}
      {tab === "logs" ? (
        detail.logs.length === 0 ? (
          <p className="cabinet-empty">Событий пока нет.</p>
        ) : (
          <>
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
                {logs.rows.map((entry, index) => (
                  <tr key={`${entry.at}-${entry.title}-${index}`}>
                    <td>{formatWhen(entry.at)}</td>
                    <td>{entry.title}</td>
                    <td>{entry.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager page={logs.page} pages={logs.pages} total={logs.total} from={logs.from} to={logs.to} onPage={logs.setPage} />
          </>
        )
      ) : null}
      {tab === "facts" ? (
        <dl className="cabinet-facts">
          <div><dt>Род</dt><dd>{facts.gender}</dd></div>
          <div><dt>Привязка</dt><dd>{facts.linked ? facts.claimStatus : "Аккаунт не привязан"}</dd></div>
          <div><dt>Откуда карточка</dt><dd>{facts.createdSource}</dd></div>
          <div><dt>Instagram</dt><dd>{facts.instagramHandle || "—"}</dd></div>
          <div><dt>Telegram</dt><dd>{facts.telegram || "—"}</dd></div>
          <div><dt>Почта в карточке</dt><dd>{facts.email || "—"}</dd></div>
          <div><dt>Создана</dt><dd>{formatWhen(facts.createdAt)}</dd></div>
          <div><dt>Изменена</dt><dd>{formatWhen(facts.updatedAt)}</dd></div>
          <div><dt>Забрана</dt><dd>{formatWhen(facts.claimedAt)}</dd></div>
          <div><dt>Оферта</dt><dd>{facts.offerAcceptedAt ? `принята ${formatWhen(facts.offerAcceptedAt)}, редакция ${facts.offerVersion || "—"}` : "не принята"}</dd></div>
          <div><dt>Обработка данных</dt><dd>{facts.privacyAcceptedAt ? `согласие ${formatWhen(facts.privacyAcceptedAt)}` : "нет согласия"}</dd></div>
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
