import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CabinetNotice } from "@/components/cabinet";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { addAdminTrainerCertificateFn, addAdminTrainerPhotoFn, removeAdminTrainerCertificateFn, removeAdminTrainerPhotoFn, reorderAdminTrainerPhotosFn, updateAdminTrainerCertificateFn } from "@/lib/admin/trainers";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { confirmAccountPhoneCodeFn, requestAccountPhoneCodeFn } from "@/lib/auth/functions";
import { authErrorMessage } from "@/lib/auth/errors";
import { saveOwnTrainerProfileFn, type OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

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
  const [form, setForm] = useState(profile);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setForm((current) => ({
      ...current,
      phone: profile.phone,
      phoneVerified: profile.phoneVerified,
      slug: profile.slug,
      photos: profile.photos,
      certificates: profile.certificates,
    }));
  }, [profile.phone, profile.phoneVerified, profile.slug, profile.photos, profile.certificates]);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  const media = form.slug
    ? {
        photos: {
          initial: form.photos,
          onUpload: async (image: string) => {
            const result = await addPhoto({ data: { slug: form.slug, image } }) as { photo: string };
            return result.photo;
          },
          onRemove: async (path: string) => {
            await removePhoto({ data: { slug: form.slug, path } });
          },
          onReorder: async (paths: string[]) => {
            await reorderPhotos({ data: { slug: form.slug, paths } });
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
          setPending(true);
          const { avatarPath: _avatarPath, slug: _slug, certificates: _certificates, photos: _photos, phoneVerified: _phoneVerified, phone: _phone, offerAccepted: _offerAccepted, privacyAccepted: _privacyAccepted, ...fields } = form;
          void save({ data: fields })
            .then(async (result) => {
              const payload = result as { message: string };
              setPopup({ title: "Готово", message: payload.message });
              await router.invalidate();
            })
            .catch((err: unknown) => setPopup({ title: "Не получилось", message: authErrorMessage(err) }))
            .finally(() => setPending(false));
        }}
      >
        {profile.offerAccepted ? (
          <p className="cabinet-note">Оферта и обработка данных приняты. Телефон подтверждается SMS в параметрах. Подтверждение почты и Telegram-бот появятся позже.</p>
        ) : (
          <p className="cabinet-note">Согласие с офертой ещё не отмечено.</p>
        )}
        <TrainerCardFields
          nick={profile.slug}
          values={form}
          onChange={(values: TrainerCardValues) => setForm((current) => ({ ...current, ...values }))}
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
        />
        <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить профиль"}</button>
        <p className="cabinet-note">Это публичная карточка. Имя для входа, почта и пароль — в соседнем разделе. Телефон здесь тот же, что в аккаунте.</p>
      </form>
      {popup ? <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} /> : null}
    </>
  );
}
