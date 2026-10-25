import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent, type ReactNode } from "react";

import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { BY_PHONE_COUNTRY_PREFIX, constrainBelarusPhoneInput } from "@/lib/auth/phone";
import { submitTrainerWelcomeFn } from "@/lib/catalog/trainer-welcome.functions";
import { optionalBelarusPhone, parseInstagramHandle, parseTelegramHandle } from "@/lib/catalog/trainer-welcome";

export const Route = createFileRoute("/join/trainer")({
  head: () => ({
    meta: [
      { title: "Привет! — тренерам trenio.by" },
      {
        name: "description",
        content:
          "Оставь Instagram — соберём предварительный профиль и пришлём тебе. Сможешь дополнить данные. Не опубликуем, пока ты его не увидишь.",
      },
      { property: "og:title", content: "Привет! — тренерам trenio.by" },
      {
        property: "og:description",
        content: "Оставь Instagram. Пришлём предварительный профиль: дополнишь данные, и только потом он выйдет.",
      },
    ],
    links: [{ rel: "canonical", href: "/join/trainer" }],
  }),
  component: TrainerWelcomePage,
});

const CSS = `
.welcome-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--light-bg); color: var(--text); }
.welcome-main { flex: 1; }
.welcome-hero {
  padding-block: clamp(28px, 5vw, 64px) clamp(48px, 7vw, 88px);
  background:
    radial-gradient(circle at 88% 8%, rgba(var(--primary-rgb), 0.22), transparent 32%),
    radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.96), transparent 42%),
    linear-gradient(180deg, #fff 0%, var(--light-bg) 72%);
}
.welcome-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 28px; color: var(--muted); font-size: 14px; }
.welcome-crumbs a { color: var(--muted); text-decoration: none; }
.welcome-crumbs a:hover { color: var(--primary); }
.welcome-crumbs span[aria-hidden] { color: var(--line); }
.welcome-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(320px, 1.08fr);
  gap: clamp(24px, 4vw, 48px);
  align-items: start;
}
.welcome-copy h1 { margin: 0 0 16px; font-size: var(--fs-display); letter-spacing: -0.04em; color: var(--dark); }
.welcome-copy p { margin: 0 0 14px; max-width: 38ch; font-size: 16px; line-height: 1.55; color: var(--text); }
.welcome-points { display: grid; gap: 10px; margin: 22px 0 0; padding: 0; list-style: none; }
.welcome-points li { display: flex; align-items: flex-start; gap: 10px; color: var(--dark); font-size: 15px; font-weight: var(--fw-ui); line-height: 1.4; }
.welcome-points svg { width: 18px; height: 18px; flex: 0 0 auto; margin-top: 1px; stroke: var(--primary); fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.welcome-card {
  position: relative;
  padding: clamp(20px, 3vw, 28px);
  border: 1px solid rgba(var(--primary-rgb), 0.28);
  border-radius: calc(var(--card-radius) + 4px);
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 186, 176, 0.55), transparent 42%),
    linear-gradient(180deg, #fff 0%, #fff6f5 100%);
  box-shadow: 0 28px 64px rgba(var(--primary-rgb), 0.22);
}
.welcome-card h2 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.03em; color: var(--dark); }
.welcome-lead { margin: 0 0 18px; color: var(--text); font-size: 15px; line-height: 1.45; }
.welcome-field { display: grid; gap: 8px; margin: 0 0 12px; }
.welcome-label { display: flex; align-items: baseline; gap: 8px; font-size: 14px; font-weight: var(--fw-ui); color: var(--dark); }
.welcome-field small { color: var(--primary-dark); font-size: 12px; font-weight: var(--fw-title); letter-spacing: 0.02em; }
.welcome-field.is-main { margin-bottom: 16px; }
.welcome-field.is-main .welcome-label { font-size: 18px; }
.welcome-input {
  display: flex; align-items: center; gap: 12px; min-height: 52px;
  padding: 0 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white);
}
.welcome-field.is-main .welcome-input {
  min-height: 64px;
  border-color: rgba(var(--primary-rgb), 0.45);
  box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.08);
}
.welcome-input:focus-within { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.16); }
.welcome-input svg { width: 22px; height: 22px; flex: 0 0 auto; display: block; }
.welcome-line { width: 22px; height: 22px; flex: 0 0 auto; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; color: var(--muted); }
.welcome-input input {
  flex: 1 1 auto; width: 100%; min-width: 0; height: 24px; margin: 0; padding: 0;
  border: 0; outline: 0; background: transparent;
  color: var(--text); font: inherit; font-size: 16px; line-height: 24px;
}
.welcome-field.is-main .welcome-input input { font-size: 18px; }
.welcome-input input::placeholder { color: var(--muted); opacity: 1; }
.welcome-error { margin: 0 0 12px; color: var(--primary-dark); font-size: 14px; font-weight: var(--fw-ui); }
.welcome-submit {
  width: 100%; min-height: 56px; margin-top: 4px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--primary); color: #fff; font: inherit; font-size: 18px; font-weight: var(--fw-title);
  box-shadow: 0 14px 28px rgba(var(--primary-rgb), 0.36);
}
.welcome-submit:hover:not(:disabled) { background: var(--primary-dark); transform: translateY(-1px); }
.welcome-submit:focus-visible { outline: 3px solid rgba(var(--primary-rgb), 0.45); outline-offset: 3px; }
.welcome-submit:disabled { opacity: 0.7; cursor: default; transform: none; }
.welcome-alt {
  display: flex; justify-content: center; margin-top: 4px;
}
.welcome-alt button {
  min-height: 44px; padding: 8px 4px; border: 0; background: transparent; cursor: pointer;
  color: var(--primary-dark); font: inherit; font-size: 15px; font-weight: var(--fw-ui);
  text-decoration: underline; text-underline-offset: 3px;
}
.welcome-alt button:hover { color: var(--primary); }
.welcome-done { display: grid; gap: 8px; padding-block: 12px 4px; }
.welcome-done h2 { margin: 0; }
.welcome-done p { margin: 0; color: var(--text); font-size: 16px; line-height: 1.5; }
.welcome-page .auth-hp { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 960px) {
  .welcome-grid { grid-template-columns: 1fr; }
  .welcome-copy p { max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .welcome-submit:hover:not(:disabled) { transform: none; }
}
`;

function PhoneIcon() {
  return (
    <svg className="welcome-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

function TrainerWelcomePage() {
  const submit = useServerFn(submitTrainerWelcomeFn);
  const [noInstagram, setNoInstagram] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [telegram, setTelegram] = useState("");
  const [phone, setPhone] = useState(BY_PHONE_COUNTRY_PREFIX);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const honeypot = honeypotFromForm(event.currentTarget);
    const channel = noInstagram ? "other" : "instagram";
    if (channel === "instagram" && !parseInstagramHandle(instagram)) {
      setError("Укажи имя в Instagram или ссылку на профиль.");
      return;
    }
    if (telegram.trim() && !parseTelegramHandle(telegram)) {
      setError("Укажи имя в Telegram или ссылку t.me/…");
      return;
    }
    const phoneResult = optionalBelarusPhone(phone);
    if (phoneResult.error) {
      setError("Укажи мобильный номер РБ: +375 25/29/33/44 …");
      return;
    }
    if (channel === "other" && !telegram.trim() && !phoneResult.phone) {
      setError("Оставь Telegram или номер телефона.");
      return;
    }
    setError(null);
    setPending(true);
    void submit({ data: { channel, instagram, telegram, phone, honeypot } })
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setDone(true);
      })
      .catch((err: unknown) => setError(authErrorMessage(err)))
      .finally(() => setPending(false));
  };

  return (
    <div className="welcome-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />
      <main className="welcome-main">
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="layout-container">
            <nav className="welcome-crumbs" aria-label="Хлебные крошки">
              <Link to="/">Главная</Link>
              <span aria-hidden="true">/</span>
              <span className="is-current" aria-current="page">Тренерам</span>
            </nav>
            <div className="welcome-grid">
              <div className="welcome-copy">
                <h1 id="welcome-title">Привет!</h1>
                <p>
                  Мы сделали проект, где подбирают тренера в Беларуси — для себя или для ребёнка. Рядом с домом, по виду спорта и городу. Формат разный: индивидуально, в группе или как удобнее.
                </p>
                <p>
                  Оставь Instagram — по нему соберём предварительный профиль и пришлём тебе. Сможешь дополнить или обновить данные. Профиль не опубликуем, пока ты его не увидишь. Telegram и телефон добавь, если есть: так проще написать. Размещение бесплатное.
                </p>
                <ul className="welcome-points">
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    Соберём карточку по твоему Instagram
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    Пришлём предварительный профиль
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    Сможешь дополнить или обновить данные
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    Не опубликуем, пока ты не посмотришь
                  </li>
                </ul>
              </div>
              <form className="welcome-card" onSubmit={onSubmit}>
                <HoneypotField />
                {done ? (
                  <div className="welcome-done">
                    <h2>Спасибо</h2>
                    <p>Скоро с тобой свяжемся и подумаем, как лучше организовать твой новый профиль.</p>
                  </div>
                ) : (
                  <>
                    <h2>{noInstagram ? "Как с тобой связаться" : "Твой Instagram"}</h2>
                    <p className="welcome-lead">
                      {noInstagram
                        ? "Оставь Telegram или телефон. Свяжемся и так же соберём профиль."
                        : "Это главное. Telegram и телефон — если есть под рукой."}
                    </p>
                    {noInstagram ? null : (
                      <Field label="Instagram" hint="самое важное" main>
                        <InstagramIcon />
                        <input
                          type="text"
                          name="instagram"
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="@имя или ссылка"
                          aria-invalid={error ? true : undefined}
                          value={instagram}
                          onChange={(event) => {
                            setInstagram(event.target.value);
                            setError(null);
                          }}
                        />
                      </Field>
                    )}
                    <Field label="Telegram">
                      <TelegramIcon />
                      <input
                        type="text"
                        name="telegram"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="@имя или t.me/…"
                        aria-invalid={error ? true : undefined}
                        value={telegram}
                        onChange={(event) => {
                          setTelegram(event.target.value);
                          setError(null);
                        }}
                      />
                    </Field>
                    <Field label="Телефон">
                      <PhoneIcon />
                      <input
                        type="tel"
                        name="phone"
                        inputMode="tel"
                        autoComplete="tel"
                        aria-invalid={error ? true : undefined}
                        value={phone}
                        onChange={(event) => {
                          setPhone(constrainBelarusPhoneInput(event.target.value));
                          setError(null);
                        }}
                      />
                    </Field>
                    {error ? <p className="welcome-error">{error}</p> : null}
                    <button className="welcome-submit" type="submit" disabled={pending}>
                      {pending ? "Отправляем…" : "Отправить"}
                    </button>
                    <div className="welcome-alt">
                      <button
                        type="button"
                        onClick={() => {
                          setNoInstagram((value) => !value);
                          setPhone((value) => constrainBelarusPhoneInput(value || BY_PHONE_COUNTRY_PREFIX));
                          setError(null);
                        }}
                      >
                        {noInstagram ? "У меня есть Instagram" : "У меня нет Instagram"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  hint,
  main = false,
  children,
}: {
  label: string;
  hint?: string;
  main?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`welcome-field${main ? " is-main" : ""}`}>
      <span className="welcome-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="welcome-input">{children}</span>
    </label>
  );
}
