import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { ExpiredLink } from "@/components/expired-link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerDoorMail } from "@/components/trainer-door-editor";
import { getMagicTrainerFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/revise")({
  loader: async () => {
    const draft = await getMagicTrainerFn();
    if (!draft) return null;
    if (draft.status === "published") throw redirect({ to: "/trainers/$slug", params: { slug: draft.slug } });
    if (!draft.magicDoor) throw redirect({ to: "/trainers/$slug", params: { slug: draft.slug } });
    return { slug: draft.slug };
  },
  head: () => ({
    meta: [
      { title: "Создание аккаунта тренера · Я ищу тренера на trenio.by" },
      { name: "description", content: "Ссылка из письма открывает кабинет." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RevisePage,
});

function RevisePage() {
  const loaded = Route.useLoaderData();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  if (!loaded) return <ExpiredLink text="Такой ссылки нет. Попросите новую в сообщении от trenio.by." />;
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card">
          {sent ? null : (
            <>
              <h1 className="auth-title">Создание аккаунта тренера</h1>
              <p className="auth-sub">Подтвердите свою страницу любым способом ниже. Черновик сразу появится в каталоге, и его увидят люди. Кабинет станет вашим: профиль можно править и вести самому. Если письма нет, загляните в папку «Спам».</p>
            </>
          )}
          <TrainerDoorMail
            autoFocus
            onSent={() => setSent(true)}
            onDone={() => {
              void navigate({ to: "/trainers/$slug", params: { slug: loaded.slug } });
            }}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
