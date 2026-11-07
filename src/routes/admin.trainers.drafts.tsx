import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/drafts")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Драфты · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Карточки тренеров, по которым ещё не было захода." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminDraftsPage,
});

function AdminDraftsPage() {
  const { trainers, outreachText } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Драфты</h2>
      <p className="cabinet-note cabinet-note--lede">
        Карточки, по которым ещё не было захода. После захода они отсюда уходят.
      </p>
      <AdminTrainersTable trainers={trainers} outreachText={outreachText} list="unvisited" />
    </article>
  );
}
