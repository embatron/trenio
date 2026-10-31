import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { enterTrainerDoorFn, finishTrainerMailFn } from "@/lib/catalog/trainer-magic";

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
      const opened = await finishTrainerMailFn({ data: { code: params.code, token: mail } });
      if (opened) throw redirect({ to: "/me/profile" });
      return null;
    }
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (!door) return null;
    throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
  },
  component: DoorMissing,
  errorComponent: DoorError,
});

function DoorError({ error }: { error: unknown }) {
  return <Missing text={authErrorMessage(error)} />;
}

function DoorMissing() {
  return <Missing text="Такой ссылки нет. Попросите новую в сообщении из Instagram." />;
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
