import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { openTrainerPreviewFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/preview/$token")({
  head: () => ({
    meta: [
      { title: "Профиль тренера · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params }) => {
    const opened = await openTrainerPreviewFn({ data: { token: params.token } });
    if (opened) throw redirect({ to: "/trainers/$slug", params: { slug: opened.slug } });
    return { ok: false as const };
  },
  component: PreviewMissing,
});

function PreviewMissing() {
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
