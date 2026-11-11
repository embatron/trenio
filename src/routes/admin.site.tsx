import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { authErrorMessage } from "@/lib/auth/errors";
import { getSiteTextsFn, saveSiteTextsFn } from "@/lib/admin/site-texts";

export const Route = createFileRoute("/admin/site")({
  loader: () => getSiteTextsFn(),
  head: () => ({
    meta: [
      { title: "Сайт · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Тексты писем и сообщения для клиентов trenio.by." },
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
  const trainerRef = useRef<HTMLTextAreaElement>(null);
  const userRef = useRef<HTMLTextAreaElement>(null);
  const instagramRef = useRef<HTMLTextAreaElement>(null);

  return (
    <article className="cabinet-card">
      <h2>Сайт</h2>
      <p className="cabinet-note cabinet-note--lede">
        Следующее письмо и следующее сообщение уже берут текст, который сохранён здесь.
        Под каждым полем написано, что можно вставить и на какое место это встанет.
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
        <div className="site-text">
          <label>
            <span>Приветственное письмо тренеру</span>
            <textarea ref={trainerRef} rows={14} value={trainerWelcome} onChange={(event) => setTrainerWelcome(event.target.value)} />
          </label>
          <p>Уходит в «Сообщения», когда создаётся аккаунт тренера. Пишет Trenioby.</p>
          <PlaceList
            field={trainerRef}
            value={trainerWelcome}
            onChange={setTrainerWelcome}
            items={[
              {
                token: "{hello}",
                text: "Приветствие. Если имя — Анна, здесь будет «Анна, привет!». Если имени нет — «Привет!». Обычно это первая строка.",
              },
              {
                token: "{telegram}",
                text: "Ссылка со словами «подключить Telegram». Она ведёт на https://t.me/TrenioByBot и открывает Mini App. Ставьте её внутри предложения: «Можно {telegram} и открывать Trenio.by как Mini App».",
              },
            ]}
          />
          <p>Пустая строка между абзацами начинает новый абзац в сообщении.</p>
        </div>
        <div className="site-text">
          <label>
            <span>Приветственное письмо пользователю</span>
            <textarea ref={userRef} rows={10} value={userWelcome} onChange={(event) => setUserWelcome(event.target.value)} />
          </label>
          <p>Уходит на почту при регистрации обычного пользователя. Тренер и клуб получают другое письмо, его здесь нет.</p>
          <PlaceList
            field={userRef}
            value={userWelcome}
            onChange={setUserWelcome}
            items={[
              {
                token: "---",
                snippet: "\n---\n",
                label: "Вставить разделитель",
                text: "Отдельная строка из трёх дефисов. На ней больше ничего не пишите. Она делит письмо на четыре части сверху вниз: заголовок, текст над кнопкой, слова на кнопке, короткая строка под кнопкой.",
              },
            ]}
          />
          <ol className="site-parts">
            <li>Заголовок. Он же тема письма. Если в заголовке нет trenio.by, к теме добавится « trenio.by».</li>
            <li>Текст над кнопкой.</li>
            <li>Слова на кнопке. Кнопка сама ведёт на подтверждение почты. Адрес ссылки в текст не вставляется.</li>
            <li>Короткая строка под кнопкой.</li>
          </ol>
        </div>
        <div className="site-text">
          <label>
            <span>Сообщение для Instagram</span>
            <textarea ref={instagramRef} rows={12} value={instagramMessage} onChange={(event) => setInstagramMessage(event.target.value)} />
          </label>
          <p>Этот текст копирует иконка текста в таблице тренеров. Его же отправляет команда первого сообщения в Instagram. Короткая ссылка в этот текст не входит: её копирует соседняя иконка и отправляет администратор следом. Слова «trenio by» при копировании и отправке становятся ссылкой https://trenio.by.</p>
          <PlaceList
            field={instagramRef}
            value={instagramMessage}
            onChange={setInstagramMessage}
            items={[
              {
                token: "{hello}",
                text: "Первая строка: «Анна, добрый день!» или «Добрый день!», если имени нет.",
              },
              {
                token: "trenio by",
                text: "Название сайта. В Instagram это ссылка на https://trenio.by.",
              },
            ]}
          />
        </div>
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

function PlaceList({
  field,
  value,
  onChange,
  items,
}: {
  field: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  items: Array<{ token: string; text: string; snippet?: string; label?: string }>;
}) {
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const node = field.current;
    if (!node || caret.current == null) return;
    node.focus();
    node.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [field, value]);

  return (
    <ul className="site-tokens">
      {items.map((item) => (
        <li key={item.token}>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const node = field.current;
              const start = node?.selectionStart ?? value.length;
              const end = node?.selectionEnd ?? start;
              const snippet = item.snippet ?? item.token;
              caret.current = start + snippet.length;
              onChange(value.slice(0, start) + snippet + value.slice(end));
            }}
          >
            {item.label ?? "Вставить"} <code>{item.token}</code>
          </button>
          <p>{item.text}</p>
        </li>
      ))}
    </ul>
  );
}
