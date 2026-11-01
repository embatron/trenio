import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerDoorMail } from "@/components/trainer-door-editor";
import { getMagicTrainerFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/revise")({
  loader: async () => {
    const draft = await getMagicTrainerFn();
    if (!draft) return null;
    if (draft.status === "published") throw redirect({ to: "/trainers/$slug", params: { slug: draft.slug } });
    if (draft.phoneLocked) throw redirect({ to: "/me" });
    return { slug: draft.slug };
  },
  head: () => ({
    meta: [
      { title: "Почта для кабинета · trenio.by" },
      { name: "description", content: "Ссылка из письма открывает кабинет." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RevisePage,
});

function RevisePage() {
  const loaded = Route.useLoaderData();
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          {loaded ? (
            <>
              <h1 className="auth-title">Почта для кабинета</h1>
              <p className="auth-sub">На этот адрес придёт ссылка. Она подтвердит почту и откроет кабинет.</p>
              <TrainerDoorMail autoFocus />
            </>
          ) : (
            <>
              <h1 className="auth-title">Ссылка уже не действует</h1>
              <p className="auth-sub">Такой ссылки нет. Попросите новую в сообщении от trenio.by.</p>
              <Link to="/" className="auth-submit" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>На главную</Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
