import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { enterTrainerDoorFn, peekTrainerMailFn } from "@/lib/catalog/trainer-magic";

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
      if (!peek) return { ready: false };
      const door = await enterTrainerDoorFn({ data: { code: params.code } });
      if (!door) return { ready: false };
      const query = new URLSearchParams({ mail, door: params.code });
      throw redirect({ href: `/trainers/${door.slug}?${query.toString()}` });
    }
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (!door) return { ready: false };
    throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
  },
  component: DoorPage,
  errorComponent: DoorError,
});

function DoorError({ error }: { error: unknown }) {
  return <Missing text={authErrorMessage(error)} />;
}

function DoorPage() {
  const { ready } = Route.useLoaderData();
  if (!ready) return <Missing text="Такой ссылки нет. Попросите новую в сообщении из Instagram." />;
  return <Missing text="Ссылка уже не действует." />;
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
