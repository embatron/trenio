import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { CabinetStyles } from "@/components/cabinet";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { authErrorMessage } from "@/lib/auth/errors";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import {
  getMagicTrainerFn,
  saveMagicTrainerFn,
  type MagicTrainerDraft,
} from "@/lib/catalog/trainer-magic";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

export const Route = createFileRoute("/trainers/revise")({
  loader: async () => {
    const draft = await getMagicTrainerFn();
    if (draft?.status === "published") throw redirect({ to: "/trainers/$slug", params: { slug: draft.slug } });
    return draft;
  },
  head: () => ({
    meta: [
      { title: "Редактирование профиля · trenio.by" },
      { name: "description", content: "Правка профиля по ссылке из сообщения." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RevisePage,
});

function valuesOf(draft: MagicTrainerDraft): TrainerCardValues {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    headline: draft.headline,
    bio: draft.bio,
    about: draft.about,
    sportSlugs: draft.sportSlugs,
    city: draft.city,
    district: draft.district,
    places: draft.places,
    priceFrom: draft.priceFrom,
    experienceYears: draft.experienceYears,
    instagram: draft.instagram,
    telegram: draft.telegram,
    email: draft.email,
    formats: draft.formats,
    audiences: draft.audiences,
  };
}

function RevisePage() {
  const loaded = Route.useLoaderData();
  if (!loaded) {
    return (
      <div className="auth-page">
        <AuthStyles />
        <SiteHeader />
        <main className="auth-main">
          <div className="auth-card">
            <h1 className="auth-title">Ссылка уже не действует</h1>
            <p className="auth-sub">Такой ссылки нет. Попросите новую в сообщении от trenio.by.</p>
            <Link to="/" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>На главную</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }
  return <ReviseForm initial={loaded} />;
}

function ReviseForm({ initial }: { initial: MagicTrainerDraft }) {
  const save = useAuthServerFn(saveMagicTrainerFn);
  const [values, setValues] = useState<TrainerCardValues>(() => valuesOf(initial));
  const [phone, setPhone] = useState(initial.phone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [publication, setPublication] = useState<"published" | "hidden">("published");

  function payload() {
    return {
      ...values,
      fullName: joinTrainerName(values.firstName, values.lastName),
      phone,
      status: publication,
    };
  }

  function run() {
    setPending(true);
    setError(null);
    setSaved(null);
    void save({ data: payload() })
      .then(() => {
        if (publication === "published") {
          window.location.assign(`/trainers/${initial.slug}`);
          return;
        }
        setSaved("Профиль скрыт. В каталоге его нет.");
      })
      .catch((err: unknown) => setError(authErrorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <div className="page-shell">
      <CabinetStyles />
      <SiteHeader />
      <main>
        <div className="layout-container" style={{ paddingBlock: "32px 64px" }}>
          <article className="cabinet-card">
            <h2>Профиль</h2>
            <p className="cabinet-note">
              Статус публикации меняете вы. При входе он стоит «Опубликован». Скрытый профиль в каталоге не показывается.
            </p>
            <form
              className="cabinet-form"
              onSubmit={(event) => {
                event.preventDefault();
                run();
              }}
            >
              <TrainerCardFields
                nick={initial.slug}
                values={values}
                onChange={setValues}
                leading={(
                  <label>
                    <span>Статус публикации</span>
                    <select value={publication} onChange={(event) => setPublication(event.target.value as "published" | "hidden")}>
                      <option value="published">Опубликован</option>
                      <option value="hidden">Скрыт</option>
                    </select>
                  </label>
                )}
                photos={null}
                certificates={null}
                phone={initial.phoneLocked
                  ? { linked: false, value: phone, locked: true, onChange: () => undefined }
                  : { linked: false, value: phone, onChange: setPhone }}
              />
              {initial.phoneLocked ? <p className="cabinet-note">Телефон привязан к аккаунту и здесь не меняется.</p> : null}
              {error ? <p className="cabinet-form__error">{error}</p> : null}
              {saved ? <p className="cabinet-form__ok">{saved}</p> : null}
              <div className="cabinet-form__actions">
                <button className="cabinet-form__submit" type="submit" disabled={pending}>
                  {pending ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
