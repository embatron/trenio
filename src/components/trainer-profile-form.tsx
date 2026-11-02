import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CabinetNotice } from "@/components/cabinet";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { addAdminTrainerCertificateFn, addAdminTrainerPhotoFn, removeAdminTrainerCertificateFn, removeAdminTrainerPhotoFn, reorderAdminTrainerPhotosFn, updateAdminTrainerCertificateFn } from "@/lib/admin/trainers";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { confirmAccountPhoneCodeFn, confirmTrainerContactEmailCodeFn, requestAccountPhoneCodeFn, requestTrainerContactEmailCodeFn } from "@/lib/auth/functions";
import { authErrorMessage } from "@/lib/auth/errors";
import { reviewPlainText, reviewTextLength } from "@/lib/catalog/review-html";
import { NICK_SUPPORT_MAX, OWN_PROFILE_STATUSES, requestNickSupportFn, saveOwnTrainerProfileFn, type OwnProfileStatus, type OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const PUBLICATION_LABEL: Record<OwnProfileStatus, string> = {
  published: "Опубликован",
  hidden: "Скрыт",
  archived: "Снят с публикации",
};

export function TrainerProfileForm({ profile }: { profile: OwnTrainerProfile }) {
  const router = useRouter();
  const save = useAuthServerFn(saveOwnTrainerProfileFn);
  const addPhoto = useAuthServerFn(addAdminTrainerPhotoFn);
  const removePhoto = useAuthServerFn(removeAdminTrainerPhotoFn);
  const reorderPhotos = useAuthServerFn(reorderAdminTrainerPhotosFn);
  const addCertificate = useAuthServerFn(addAdminTrainerCertificateFn);
  const updateCertificate = useAuthServerFn(updateAdminTrainerCertificateFn);
  const removeCertificate = useAuthServerFn(removeAdminTrainerCertificateFn);
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const requestContactEmail = useAuthServerFn(requestTrainerContactEmailCodeFn);
  const confirmContactEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);
  const requestNick = useAuthServerFn(requestNickSupportFn);
  const [form, setForm] = useState(profile);
  const [publication, setPublication] = useState<OwnProfileStatus>(profile.status);
  const [pending, setPending] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  useEffect(() => {
    setForm((current) => ({
      ...current,
      phone: profile.phone,
      phoneVerified: profile.phoneVerified,
      email: profile.email,
      emailVerified: profile.emailVerified,
      instagram: profile.instagram,
      telegram: profile.telegram,
      slug: profile.slug,
      photos: profile.photos,
      certificates: profile.certificates,
    }));
  }, [profile.phone, profile.phoneVerified, profile.email, profile.emailVerified, profile.instagram, profile.telegram, profile.slug, profile.photos, profile.certificates]);
  const [bioInvalid, setBioInvalid] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  const media = form.slug
    ? {
        photos: {
          initial: form.photos,
          onUpload: async (image: string) => {
            const result = await addPhoto({ data: { slug: form.slug, image } }) as { photo: string };
            await router.invalidate();
            return result.photo;
          },
          onRemove: async (path: string) => {
            await removePhoto({ data: { slug: form.slug, path } });
            await router.invalidate();
          },
          onReorder: async (paths: string[]) => {
            await reorderPhotos({ data: { slug: form.slug, paths } });
            await router.invalidate();
          },
        },
        certificates: {
          initial: form.certificates,
          onUpload: async (file: { name: string; dataUrl: string }, caption: string) => {
            const result = await addCertificate({ data: { slug: form.slug, fileName: file.name, caption, dataUrl: file.dataUrl } }) as { certificate: TrainerCertificate };
            return result.certificate;
          },
          onCaption: async (path: string, caption: string) => {
            await updateCertificate({ data: { slug: form.slug, path, caption } });
          },
          onRemove: async (path: string) => {
            await removeCertificate({ data: { slug: form.slug, path } });
          },
        },
      }
    : null;

  return (
    <>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reviewPlainText(form.bio)) {
            setBioInvalid(true);
            setPopup({ title: "Не получилось", message: "Напишите, как вас представить." });
            return;
          }
          setBioInvalid(false);
          setPending(true);
          const { avatarPath: _avatarPath, slug: _slug, certificates: _certificates, photos: _photos, phoneVerified: _phoneVerified, emailVerified: _emailVerified, telegramVerified: _telegramVerified, phone: _phone, offerAccepted: _offerAccepted, privacyAccepted: _privacyAccepted, firstName: _firstName, lastName: _lastName, ...fields } = form;
          void save({ data: { ...fields, status: publication } })
            .then(async (result) => {
              const payload = result as { message: string };
              setPopup({ title: "Готово", message: payload.message });
              await router.invalidate();
            })
            .catch((err: unknown) => setPopup({ title: "Не получилось", message: authErrorMessage(err) }))
            .finally(() => setPending(false));
        }}
      >
        {profile.offerAccepted ? null : (
          <p className="cabinet-note">Согласие с офертой ещё не отмечено.</p>
        )}
        <TrainerCardFields
          nick={profile.slug}
          self
          priceLabel="Сколько у меня стоит разовое занятие (персональная тренировка), BYN?"
          values={form}
          bioInvalid={bioInvalid}
          onChange={(values: TrainerCardValues) => {
            if (reviewPlainText(values.bio)) setBioInvalid(false);
            setForm((current) => ({ ...current, ...values }));
          }}
          mode="profile"
          photos={media?.photos ?? null}
          certificates={media?.certificates ?? null}
          phone={{
            linked: true,
            value: form.phone,
            verified: form.phoneVerified,
            onRequest: async (phone) => (await requestPhone({ data: { phone } })) as { message: string; already?: boolean; devCode?: string },
            onConfirm: async (phone, code) => (await confirmPhone({ data: { phone, code } })) as { message: string },
            onVerified: () => {
              void router.invalidate();
            },
          }}
          onNickSupport={() => setSupportOpen(true)}
          leading={(
            <fieldset className="publish-pick">
              <legend>Статус публикации</legend>
              <div className="publish-pick__row" role="group" aria-label="Статус публикации">
                {OWN_PROFILE_STATUSES.map((status) => {
                  const on = publication === status;
                  return (
                    <label key={status} className={`publish-pick__option is-${status}${on ? " is-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setPublication(status)}
                      />
                      <span className="publish-pick__box" aria-hidden="true" />
                      <span>{PUBLICATION_LABEL[status]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          emailConfirm={{
            verified: form.emailVerified,
            onRequest: async (email) => (await requestContactEmail({ data: { email } })) as { message: string; already?: boolean; devCode?: string },
            onConfirm: async (email, code) => (await confirmContactEmail({ data: { email, code } })) as { message: string },
            onVerified: () => {
              void router.invalidate();
            },
          }}
        />
        <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить профиль"}</button>
      </form>
      {popup ? <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} /> : null}
      {supportOpen ? (
        <NickSupportDialog
          nick={profile.slug}
          onSend={(request) => requestNick({ data: { request } }) as Promise<{ message: string }>}
          onClose={() => setSupportOpen(false)}
        />
      ) : null}
    </>
  );
}

function NickSupportDialog({
  nick,
  onSend,
  onClose,
}: {
  nick: string;
  onSend: (request: string) => Promise<{ message: string }>;
  onClose: () => void;
}) {
  const [request, setRequest] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const length = reviewTextLength(request);
  const over = length > NICK_SUPPORT_MAX;
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
        aria-labelledby="nick-support-title"
        onClick={(event) => event.stopPropagation()}
      >
        {sent ? (
          <>
            <h2 id="nick-support-title">Запрос отправлен</h2>
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
            <h2 id="nick-support-title">Смена ника</h2>
            <p>Сейчас адрес /trainers/{nick}. Напишите, какой ник нужен.</p>
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
            <p className={over ? "cabinet-form__error" : "cabinet-note"}>{length}/{NICK_SUPPORT_MAX}</p>
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
