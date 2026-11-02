import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CabinetNotice } from "@/components/cabinet";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { confirmAccountPhoneCodeFn, confirmTrainerContactEmailCodeFn, requestAccountPhoneCodeFn, requestTrainerContactEmailCodeFn } from "@/lib/auth/functions";
import { authErrorMessage } from "@/lib/auth/errors";
import { saveOwnTrainerContactsFn, type OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

export function TrainerContactsForm({ profile }: { profile: OwnTrainerProfile }) {
  const router = useRouter();
  const save = useAuthServerFn(saveOwnTrainerContactsFn);
  const requestPhone = useAuthServerFn(requestAccountPhoneCodeFn);
  const confirmPhone = useAuthServerFn(confirmAccountPhoneCodeFn);
  const requestContactEmail = useAuthServerFn(requestTrainerContactEmailCodeFn);
  const confirmContactEmail = useAuthServerFn(confirmTrainerContactEmailCodeFn);
  const [form, setForm] = useState(profile);
  const [pending, setPending] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      phone: profile.phone,
      phoneVerified: profile.phoneVerified,
      email: profile.email,
      emailVerified: profile.emailVerified,
      instagram: profile.instagram,
      telegram: profile.telegram,
      telegramVerified: profile.telegramVerified,
    }));
  }, [profile.phone, profile.phoneVerified, profile.email, profile.emailVerified, profile.instagram, profile.telegram, profile.telegramVerified]);

  return (
    <>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          void save({ data: { instagram: form.instagram, telegram: form.telegram } })
            .then(async (result) => {
              const payload = result as { message: string };
              setPopup({ title: "Готово", message: payload.message });
              await router.invalidate();
            })
            .catch((err: unknown) => setPopup({ title: "Не получилось", message: authErrorMessage(err) }))
            .finally(() => setPending(false));
        }}
      >
        <TrainerCardFields
          mode="contacts"
          self
          telegramVerified={form.telegram === profile.telegram && profile.telegramVerified}
          values={form}
          onChange={(values: TrainerCardValues) => setForm((current) => ({ ...current, ...values }))}
          photos={null}
          certificates={null}
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
        <button className="cabinet-form__submit" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить контакты"}
        </button>
      </form>
      {popup ? <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} /> : null}
    </>
  );
}
