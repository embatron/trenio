import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { authErrorMessage } from "@/lib/auth/errors";
import { getSiteTextsFn, saveSiteTextsFn } from "@/lib/admin/site-texts";

export const Route = createFileRoute("/admin/site")({
  loader: () => getSiteTextsFn(),
  head: () => ({
    meta: [
      { title: "Настройки сайта · кабинет администратора · trenio.by" },
      { name: "description", content: "Тексты писем и сообщений для клиентов trenio.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminSitePage,
});

function AdminSitePage() {
  const loaded = Route.useLoaderData();
  const save = useServerFn(saveSiteTextsFn);
  const [trainerWelcome, setTrainerWelcome] = useState(loaded.trainerWelcome);
  const [userWelcome, setUserWelcome] = useState(loaded.userWelcome);
  const [instagramMessage, setInstagramMessage] = useState(loaded.instagramMessage);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  return (
    <article className="cabinet-card">
      <h2>Настройки сайта</h2>
      <p className="cabinet-note cabinet-note--lede">
        Следующее письмо и следующее сообщение уже берут текст, который сохранён здесь.
      </p>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setStatus("");
          setError("");
          void save({ data: { trainerWelcome, userWelcome, instagramMessage } })
            .then(() => setStatus("Сохранено. Новые тексты уже используются."))
            .catch((err: unknown) => setError(authErrorMessage(err)))
            .finally(() => setPending(false));
        }}
      >
        <label>
          <span>Приветственное письмо тренеру</span>
          <textarea rows={14} value={trainerWelcome} onChange={(event) => setTrainerWelcome(event.target.value)} />
          <p className="cabinet-note">
            {"{hello}"} — «Имя, привет!». {"{telegram}"} — ссылка на бота и Mini App. Уходит в «Сообщения» при создании аккаунта тренера.
          </p>
        </label>
        <label>
          <span>Приветственное письмо пользователю</span>
          <textarea rows={10} value={userWelcome} onChange={(event) => setUserWelcome(event.target.value)} />
          <p className="cabinet-note">
            Четыре части через строку --- : заголовок, текст, подпись кнопки, примечание. Кнопка ведёт на подтверждение почты. Письмо уходит при регистрации пользователя.
          </p>
        </label>
        <label>
          <span>Сообщение для Instagram</span>
          <textarea rows={12} value={instagramMessage} onChange={(event) => setInstagramMessage(event.target.value)} />
          <p className="cabinet-note">
            {"{hello}"} — обращение. {"{gaps}"} — пустые поля карточки или просьба проверить страницу. {"{doorUrl}"} — короткая ссылка. Этот текст копирует конверт в таблице тренеров.
          </p>
        </label>
        {error ? <p className="cabinet-form__error" role="alert">{error}</p> : null}
        {status ? <p className="cabinet-form__ok" role="status">{status}</p> : null}
        <div className="cabinet-form__actions">
          <button className="cabinet-form__submit" type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </article>
  );
}
