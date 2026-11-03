import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { AuthAlert, useAuthSubmit, useAuthServerFn } from "@/lib/auth/use-auth-form";
import { enterTrainerDoorFn, openTrainerMailFn, peekTrainerMailFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/hi/$code")({
  head: () => ({
    meta: [
      { title: "Ссылка · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params, location }) => {
    const mail = new URLSearchParams(location.searchStr).get("mail") ?? "";
    if (mail) {
      const peek = await peekTrainerMailFn({ data: { code: params.code, token: mail } });
      return { mail, ready: Boolean(peek) };
    }
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (!door) return { mail: "", ready: false };
    throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
  },
  component: DoorPage,
  errorComponent: DoorError,
});

function DoorError({ error }: { error: unknown }) {
  return <Missing text={authErrorMessage(error)} />;
}

function DoorPage() {
  const { mail, ready } = Route.useLoaderData();
  const { code } = Route.useParams();
  if (mail && ready) return <ConfirmMail code={code} mail={mail} />;
  return <Missing text="Такой ссылки нет. Попросите новую в сообщении из Instagram." />;
}

function ConfirmMail({ code, mail }: { code: string; mail: string }) {
  const router = useRouter();
  const open = useAuthServerFn(openTrainerMailFn);
  const { error, pending, run } = useAuthSubmit();
  const [done, setDone] = useState(false);

  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Открыть кабинет</h1>
          <p className="auth-sub">Ссылка действует час. Нажмите кнопку, чтобы войти.</p>
          <AuthAlert message={error} />
          <button
            type="button"
            className="auth-submit"
            disabled={pending || done}
            onClick={() => {
              void run(
                () => open({ data: { code, token: mail } }),
                async (result) => {
                  if (!result) return;
                  setDone(true);
                  await router.invalidate();
                  window.location.assign(result.redirectTo);
                },
              );
            }}
          >
            {pending ? "Открываем…" : "Открыть кабинет"}
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Ссылка уже не действует</h1>
          <p className="auth-sub">{text}</p>
          <Link to="/" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>На главную</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
