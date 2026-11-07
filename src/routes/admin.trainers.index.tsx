import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Весь список · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Все карточки тренеров: неопубликованные и опубликованные." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminTrainersPage,
});

function AdminTrainersPage() {
  const { trainers, outreachText } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Весь список</h2>
      <AdminTrainersTable trainers={trainers} outreachText={outreachText} />
    </article>
  );
}
