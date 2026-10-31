import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetStyles } from "@/components/cabinet";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { confirmDoorEmailFn, requestDoorEmailFn, saveMagicTrainerFn, type MagicTrainerDraft } from "@/lib/catalog/trainer-magic";

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

/** Profile editor opened by the short Instagram link. Email confirmation activates the account. */
export function TrainerDoorEditor({ draft }: { draft: MagicTrainerDraft }) {
  const requestEmail = useAuthServerFn(requestDoorEmailFn);
  const confirmEmail = useAuthServerFn(confirmDoorEmailFn);
  const save = useAuthServerFn(saveMagicTrainerFn);
  const [values, setValues] = useState<TrainerCardValues>(() => valuesOf(draft));
  const [phone, setPhone] = useState(draft.phone);
  const [publication, setPublication] = useState<"published" | "hidden">("published");
  const [email, setEmail] = useState(draft.email);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<string>) {
    setPending(true);
    setError(null);
    void task()
      .then((message) => setNote(message))
      .catch((err: unknown) => setError(authErrorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <section className="door-editor" aria-label="Редактирование профиля">
      <CabinetStyles />
      <style>{`
        .door-editor { margin: 0 0 28px; }
        .door-editor .cabinet-card { margin: 0; }
        .door-editor__mail { display: grid; gap: 12px; margin: 0 0 20px; }
        .door-editor__row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
        .door-editor__row label { flex: 1 1 220px; }
        .door-editor__row button { min-height: 44px; }
      `}</style>
      <article className="cabinet-card">
        <h2>Ваш профиль</h2>
        <p className="cabinet-note">
          Мы заполнили страницу по открытым данным и в каталог её не ставили. Ниже та же форма, что в настройках профиля.
          Сначала почта: код из письма подтверждает её, аккаунт становится активным, а ссылка в том же письме сразу открывает редактирование.
          Статус публикации при входе — «Опубликован». Его можно сменить на «Скрыт».
        </p>
        <div className="door-editor__mail">
          <div className="door-editor__row">
            <label>
              <span>Почта</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                disabled={active}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              className="cabinet-form__submit"
              type="button"
              disabled={pending || active}
              onClick={() => run(async () => {
                const result = await requestEmail({ data: { email: email.trim() } }) as { message: string; devCode?: string };
                setSent(true);
                return result.devCode ? `${result.message} Код для проверки: ${result.devCode}` : result.message;
              })}
            >
              Отправить код
            </button>
          </div>
          {sent && !active ? (
            <div className="door-editor__row">
              <label>
                <span>Код из письма</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button
                className="cabinet-form__submit"
                type="button"
                disabled={pending}
                onClick={() => run(async () => {
                  const result = await confirmEmail({ data: { email: email.trim(), code } }) as { message: string };
                  setActive(true);
                  return result.message;
                })}
              >
                Подтвердить почту
              </button>
            </div>
          ) : null}
          {active ? <p className="cabinet-form__ok">Почта подтверждена. <Link to="/me/profile">Открыть редактирование в кабинете</Link></p> : null}
        </div>
        <form
          className="cabinet-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await save({
                data: {
                  ...values,
                  phone,
                  status: publication,
                },
              });
              if (publication === "published") {
                window.location.assign(`/trainers/${draft.slug}`);
                return "Профиль опубликован.";
              }
              return "Профиль скрыт. В каталоге его нет.";
            });
          }}
        >
          <TrainerCardFields
            nick={draft.slug}
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
            phone={draft.phoneLocked
              ? { linked: false, value: phone, locked: true, onChange: () => undefined }
              : { linked: false, value: phone, onChange: setPhone }}
          />
          {error ? <p className="cabinet-form__error">{error}</p> : null}
          {note ? <p className="cabinet-form__ok">{note}</p> : null}
          <div className="cabinet-form__actions">
            <button className="cabinet-form__submit" type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
