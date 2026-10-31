import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { openTrainerEditFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/edit/$token")({
  head: () => ({
    meta: [
      { title: "Редактирование профиля · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params }) => {
    const opened = await openTrainerEditFn({ data: { token: params.token } });
    if (!opened) return { ok: false as const };
    if (opened.published) throw redirect({ to: "/trainers/$slug", params: { slug: opened.slug } });
    throw redirect({ to: "/trainers/revise" });
  },
  component: EditMissing,
});

function EditMissing() {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Ссылка уже не действует</h1>
          <p className="auth-sub">Такой ссылки нет. Попросите новую в сообщении от trenio.by.</p>
          <Link to="/" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>На главную</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
