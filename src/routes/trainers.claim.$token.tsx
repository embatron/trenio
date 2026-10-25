import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { PhotoImage } from "@/components/photo-image";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { claimTrainerProfileFn, getTrainerClaimFn } from "@/lib/catalog/trainer-claim";

export const Route = createFileRoute("/trainers/claim/$token")({
  head: () => ({
    meta: [
      { title: "Привязать профиль тренера · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params }) => {
    const preview = await getTrainerClaimFn({ data: { token: params.token } });
    if (preview.published || preview.claimed) throw redirect({ to: "/trainers/$slug", params: { slug: preview.slug } });
    return preview;
  },
  component: ClaimPage,
  errorComponent: ClaimMissing,
});

function ClaimMissing() {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Ссылка не найдена</h1>
          <p className="auth-sub">Попросите новую ссылку в сообщении от trenio.by.</p>
          <Link to="/auth/login" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Войти</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const met = [password.length >= 8, /\d/.test(password), /[A-ZА-ЯЁ]/.test(password)].filter(Boolean).length;
  const level = password.length === 0 ? 0 : Math.max(met, 1);
  const width = password.length === 0 ? 0 : met === 0 ? 16 : (met / 3) * 100;
  return (
    <div className={`claim-strength is-${level}`} aria-hidden="true">
      <svg className="claim-strength__mark" viewBox="0 0 24 24">
        <path d="M5 16v3" />
        <path d="M12 11v8" />
        <path d="M19 6v13" />
      </svg>
      <span className="claim-strength__track"><span style={{ width: `${width}%` }} /></span>
    </div>
  );
}

function ClaimPage() {
  const preview = Route.useLoaderData();
  const { token } = Route.useParams();
  const claim = useAuthServerFn(claimTrainerProfileFn);
  const [nick] = useState(preview.handle);
  const [enterCard, setEnterCard] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [offer, setOffer] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordMismatch = passwordConfirm.length > 0 && passwordConfirm !== password;
  useLayoutEffect(() => {
    const key = `trenio-claim-profile:${preview.handle}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; } catch { seen = true; }
    if (seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      return;
    }
    setEnterCard(true);
  }, [preview.handle]);

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--wide">
          <div className="auth-card__head">
            <h1 className="auth-title">Привет, <span className="claim-hello">{preview.givenName}</span></h1>
            <p className="auth-sub">Мы объединяем тренеров по всем видам спорта в одном месте и хотим, чтобы ты {preview.addressAs} частью этой спортивной семьи из Беларуси.</p>
            <p className="auth-sub">Твой профиль уже подготовлен по открытым данным из Instagram, но пока не опубликован. Ты можешь обновить или изменить его самостоятельно. В ближайшем будущем ты сможешь получать прямые заявки от клиентов, которые ищут именно тебя.</p>
            <p className="auth-sub">Твоё участие абсолютно бесплатно!</p>
          </div>
          <div
            className={enterCard ? "claim-preview profile-card-enter" : "claim-preview"}
            onAnimationEnd={() => {
              try { localStorage.setItem(`trenio-claim-profile:${preview.handle}`, "1"); } catch { /* ignore */ }
            }}
          >
            {preview.photo ? <PhotoImage src={preview.photo} alt="" preset="avatar" width={72} height={72} /> : null}
            <div>
              <strong>{preview.fullName || "Тренер"}</strong>
              <span>{[preview.headline, preview.city].filter(Boolean).join(" · ") || "Город ещё не указан"}</span>
            </div>
          </div>
          {preview.claimed ? (
            <p className="auth-sub">Профиль уже привязан к аккаунту. Войдите почтой, ником, телефоном или Telegram.</p>
          ) : (
          <form
              className="auth-form claim-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (password !== passwordConfirm) {
                  setError("Пароли не совпадают.");
                  return;
                }
                if (!offer || !privacy) {
                  setError("Нужны обе галочки: оферта и обработка данных.");
                  return;
                }
                setPending(true);
                setError(null);
                void claim({ data: { token, nick, email, password, passwordConfirm, offer: true, privacy: true } })
                  .then(() => {
                    window.location.href = "/me/profile";
                  })
                  .catch((err: unknown) => {
                    setError(authErrorMessage(err));
                    setPending(false);
                  });
              }}
            >
              <label className="auth-field">
                <span className="auth-field__label">Ник</span>
                <input className="is-locked" type="text" value={nick} readOnly required aria-readonly="true" autoComplete="username" />
                <span className="auth-field__hint auth-field__hint--block">Ник совпадает с Instagram: /trainers/{preview.handle}. Сменить его можно только по запросу в поддержку.</span>
              </label>
              <label className="auth-field">
                <span className="auth-field__label">Эл. почта</span>
                <input type="email" value={email} required maxLength={320} autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="auth-field">
                <span className="auth-field__label">Пароль</span>
                <div className="auth-field__input-wrap">
                  <input type={showPassword ? "text" : "password"} value={password} required minLength={8} maxLength={128} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="auth-field__toggle" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </label>
              <label className="auth-field">
                <span className="auth-field__label">Пароль ещё раз</span>
                <div className="auth-field__input-wrap">
                  <input type={showPassword ? "text" : "password"} value={passwordConfirm} required minLength={8} maxLength={128} autoComplete="new-password" aria-invalid={passwordMismatch} onChange={(event) => setPasswordConfirm(event.target.value)} />
                  <button type="button" className="auth-field__toggle" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                {passwordMismatch ? <span className="auth-field__hint auth-field__hint--block">Пароли пока не совпадают.</span> : null}
              </label>
              <div className="claim-consents">
                <label className="claim-check">
                  <input type="checkbox" required checked={offer} onChange={(event) => setOffer(event.target.checked)} />
                  <span>Согласен с <Link to="/offer">договором оферты</Link></span>
                </label>
                <label className="claim-check">
                  <input type="checkbox" required checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />
                  <span>Согласен на обработку данных по <Link to="/privacy">политике конфиденциальности</Link></span>
                </label>
              </div>
              {error ? <p className="auth-alert" role="alert">{error}</p> : null}
              <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Вход…" : "Привязать профиль"}</button>
            </form>
          )}
          {preview.claimed ? (
            <Link to="/auth/login" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Войти</Link>
          ) : null}
        </div>
      </main>
      <SiteFooter />
      <style>{CLAIM_CSS}</style>
    </div>
  );
}

const CLAIM_CSS = `
.claim-preview { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; }
.claim-preview img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
.claim-preview strong, .claim-preview span { display: block; }
.claim-preview span { color: var(--muted); font-size: 14px; }
.claim-hello { color: var(--primary); }
.auth-card__head .auth-sub + .auth-sub { margin-top: 10px; }
.claim-form .auth-field input { height: 48px; }
.claim-form .auth-field__label,
.claim-form .auth-field__hint--block,
.claim-form .auth-field__toggle { font-size: 14px; }
.claim-form .auth-field__input-wrap input { padding-right: 112px; }
.claim-form input.is-locked { background: #eceff3; color: var(--muted); cursor: default; }
.auth-main { overflow-x: clip; }
@keyframes profile-card-in {
  from { opacity: 0; transform: translateX(64px); }
  to { opacity: 1; transform: none; }
}
.profile-card-enter { animation: profile-card-in 640ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.claim-strength { display: flex; align-items: center; gap: 10px; min-height: 28px; }
.claim-strength__mark { width: 28px; height: 28px; flex: 0 0 auto; }
.claim-strength__mark path { fill: none; stroke: rgba(var(--dark-rgb), 0.18); stroke-width: var(--icon-stroke); stroke-linecap: round; }
.claim-strength.is-1 .claim-strength__mark path:nth-child(-n+1),
.claim-strength.is-2 .claim-strength__mark path:nth-child(-n+2),
.claim-strength.is-3 .claim-strength__mark path { stroke: currentColor; }
.claim-strength.is-1 { color: #d97706; }
.claim-strength.is-2 { color: #ca8a04; }
.claim-strength.is-3 { color: #15803d; }
.claim-strength__track { flex: 1; height: 6px; border-radius: 999px; background: rgba(var(--dark-rgb), 0.1); overflow: hidden; }
.claim-strength__track > span { display: block; height: 100%; border-radius: inherit; background: currentColor; transition: width 0.2s ease; }
@media (prefers-reduced-motion: reduce) {
  .profile-card-enter { animation: none; }
  .claim-strength__track > span { transition: none; }
}
.claim-form .auth-field__toggle { min-width: 44px; min-height: 44px; }
.claim-consents { display: grid; gap: 2px; }
.claim-check { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 0; font-size: 15px; line-height: 1.35; }
.claim-check input { width: 22px; height: 22px; margin: 0; flex: 0 0 auto; }
.claim-check a { color: var(--primary-dark); }
`;
