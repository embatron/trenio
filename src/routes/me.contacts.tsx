import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { TrainerContactsForm } from "@/components/trainer-contacts-form";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/contacts")({
  head: () => ({
    meta: [
      { title: "Контакты · trenio.by" },
      { name: "description", content: "Телефон, почта, Instagram и Telegram на странице тренера." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeContactsPage,
});

function MeContactsPage() {
  const { trainer } = meRoute.useLoaderData();
  if (!trainer) {
    return (
      <article className="cabinet-card">
        <h2>Контакты</h2>
        <p className="cabinet-empty">Карточка в каталоге к этому аккаунту пока не привязана.</p>
      </article>
    );
  }

  return (
    <article className="cabinet-card">
      <h2>Контакты</h2>
      <p className="cabinet-note cabinet-note--lede">
        Телефон, почта, Instagram и Telegram. Они стоят на публичной странице отдельно от текста профиля.
      </p>
      <TrainerContactsForm profile={trainer} />
    </article>
  );
}
