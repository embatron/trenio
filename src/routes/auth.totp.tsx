import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { beginTotpFn, confirmLoginTotpFn, confirmTotpFn, logoutFn, pendingTotpFn } from "@/lib/auth/functions";
import { getPostLoginPath } from "@/lib/auth/roles";
import { STAFF_TOTP_REQUIRED } from "@/lib/auth/staff-totp";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/auth/totp")({
  beforeLoad: ({ context }) => {
    if (STAFF_TOTP_REQUIRED) return;
    throw redirect({ to: context.user ? getPostLoginPath(context.user.roles) : "/auth/login" });
  },
  head: () => ({
    meta: [
      { title: "Код для кабинета — trenio.by" },
      NOINDEX_FOLLOW,
    ],
  }),
  component: TotpPage,
});

function TotpPage() {
  const router = useRouter();
  const user = Route.useRouteContext().user;
  const enroll = Boolean(user?.needsTotp);
  const pendingSecret = useAuthServerFn(pendingTotpFn);
  const begin = useAuthServerFn(beginTotpFn);
  const confirmEnroll = useAuthServerFn(confirmTotpFn);
  const confirmLogin = useAuthServerFn(confirmLoginTotpFn);
  const logout = useAuthServerFn(logoutFn);
  const { error, pending, run } = useAuthSubmit();
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);

  useEffect(() => {
    if (!enroll) return;
    let alive = true;
    void pendingSecret()
      .then((row) => {
        if (alive && row.secret) setSecret(row.secret);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enroll, pendingSecret]);

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">{enroll ? "Код для кабинета" : "Код из приложения"}</h1>
          <p className="auth-sub">
            {enroll
              ? "Кабинет сотрудника открывается шестизначным кодом с телефона. Подойдёт Яндекс Ключ, Google Authenticator или другое приложение для одноразовых кодов."
              : "Откройте приложение, куда добавлен Trenio, и введите шесть цифр."}
          </p>
          <AuthAlert message={error} />
          {recovery ? (
            <div className="auth-alert auth-alert--note">
              <p>Запишите эти коды и уберите их от экрана. Каждый открывает кабинет один раз, если телефона нет рядом.</p>
              <p className="auth-secret">{recovery.join(" ")}</p>
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
              {secret ? (
                <>
                  <p className="auth-sub">
                    В приложении выберите добавление по ключу и вставьте эту строку. Появятся шесть цифр. Введите их ниже.
                  </p>
                  <p className="auth-secret">{secret}</p>
                </>
              ) : null}
              {secret || !enroll ? (
                <label className="auth-field">
                  <span className="auth-field__label">Шесть цифр</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Проверка…" : enroll && !secret ? "Получить ключ" : enroll ? "Открыть кабинет" : "Войти"}
              </button>
            </form>
          )}
          <p className="auth-foot">
            <button
              type="button"
              className="auth-resend"
              onClick={() => {
                void logout().then(() => {
                  window.location.assign("/auth/login");
                });
              }}
            >
              Выйти
            </button>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
