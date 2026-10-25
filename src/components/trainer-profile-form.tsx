import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CabinetNotice } from "@/components/cabinet";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { addAdminTrainerCertificateFn, addAdminTrainerPhotoFn, removeAdminTrainerCertificateFn, removeAdminTrainerPhotoFn, reorderAdminTrainerPhotosFn, updateAdminTrainerCertificateFn } from "@/lib/admin/trainers";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { confirmAccountPhoneCodeFn, confirmTrainerContactEmailCodeFn, requestAccountPhoneCodeFn, requestTrainerContactEmailCodeFn } from "@/lib/auth/functions";
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
  const requestContactEmail = useAuthServerFn(requestTrainerContactEmailCodeFn);
  const confirmContactEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);
  const [form, setForm] = useState(profile);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setForm((current) => ({
      ...current,
      phone: profile.phone,
      phoneVerified: profile.phoneVerified,
      email: profile.email,
      emailVerified: profile.emailVerified,
      slug: profile.slug,
      photos: profile.photos,
      certificates: profile.certificates,
    }));
  }, [profile.phone, profile.phoneVerified, profile.email, profile.emailVerified, profile.slug, profile.photos, profile.certificates]);
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
          setPending(true);
          const { avatarPath: _avatarPath, slug: _slug, certificates: _certificates, photos: _photos, phoneVerified: _phoneVerified, emailVerified: _emailVerified, telegramVerified: _telegramVerified, phone: _phone, offerAccepted: _offerAccepted, privacyAccepted: _privacyAccepted, firstName: _firstName, lastName: _lastName, ...fields } = form;
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
        {profile.offerAccepted ? null : (
          <p className="cabinet-note">Согласие с офертой ещё не отмечено.</p>
        )}
        <TrainerCardFields
          nick={profile.slug}
          self
          priceLabel="Сколько у меня стоит разовое занятие (персональная тренировка), BYN?"
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
    </>
  );
}
