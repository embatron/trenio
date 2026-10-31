import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { enterTrainerDoorFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/hi/$code/edit")({
  head: () => ({ meta: [{ title: "Профиль тренера · trenio.by" }, { name: "robots", content: "noindex,follow" }] }),
  loader: async ({ params }) => {
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (door) throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
    return { ok: false as const };
  },
  component: Missing,
});

function Missing() {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Ссылка уже не действует</h1>
          <p className="auth-sub">Такой ссылки нет. Попросите новую в сообщении из Instagram.</p>
          <Link to="/" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>На главную</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
