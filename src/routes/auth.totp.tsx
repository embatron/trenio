import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { beginTotpFn, confirmLoginTotpFn, confirmTotpFn, logoutFn } from "@/lib/auth/functions";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/totp")({
  head: () => ({
    meta: [
      { title: "Код подтверждения — trenio.by" },
      NOINDEX_FOLLOW,
    ],
  }),
  component: TotpPage,
});

function TotpPage() {
  const router = useRouter();
  const user = Route.useRouteContext().user;
  const enroll = Boolean(user?.needsTotp);
  const begin = useAuthServerFn(beginTotpFn);
  const confirmEnroll = useAuthServerFn(confirmTotpFn);
  const confirmLogin = useAuthServerFn(confirmLoginTotpFn);
  const logout = useAuthServerFn(logoutFn);
  const { error, pending, run } = useAuthSubmit();
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">{enroll ? "Подключите код" : "Код из приложения"}</h1>
          <p className="auth-sub">
            {enroll
              ? "Кабинет сотрудника открывается после кода из приложения. Сохраните запасные коды."
              : "Введите код из приложения или один запасной код."}
          </p>
          <AuthAlert message={error} />
          {recovery ? (
            <div className="auth-alert auth-alert--note">
              <p>Запишите запасные коды. Каждый срабатывает один раз.</p>
              <p>{recovery.join(" ")}</p>
              <button type="button" className="auth-submit" onClick={() => void router.invalidate().then(() => router.navigate({ to: "/admin" }))}>
                В кабинет
              </button>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  if (enroll && !secret) {
                    const started = await begin();
                    setSecret(started.secret);
                    setUri(started.uri);
                    return { ok: true as const };
                  }
                  if (enroll) {
                    const done = await confirmEnroll({ data: { code } });
                    setRecovery(done.codes);
                    return done;
                  }
                  return confirmLogin({ data: { code } });
                }, async (result) => {
                  if (!result || enroll) return;
                  if ("redirectTo" in result && result.redirectTo) {
                    await router.invalidate();
                    window.location.assign(result.redirectTo);
                  }
                });
              }}
            >
              {secret ? <p className="auth-alert auth-alert--note">Секрет: {secret}</p> : null}
              {uri ? <p className="cabinet-note">{uri}</p> : null}
              {secret || !enroll ? (
                <label className="auth-field">
                  <span className="auth-field__label">Код</span>
                  <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
                </label>
              ) : null}
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Проверка…" : enroll && !secret ? "Показать секрет" : "Подтвердить"}
              </button>
            </form>
          )}
          <button
            type="button"
            className="auth-submit"
            onClick={() => {
              void logout().then(() => {
                window.location.assign("/auth/login");
              });
            }}
          >
            Выйти
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
