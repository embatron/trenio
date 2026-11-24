import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/declined")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Отказались · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Карточки, которым администратор поставил статус «Отказались»." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminDeclinedTrainersPage,
});

function AdminDeclinedTrainersPage() {
  const { trainers } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Отказались</h2>
      <p className="cabinet-note cabinet-note--lede">
        Статус ставится в карточке тренера. Тренер сам его не выбирает.
      </p>
      <AdminTrainersTable trainers={trainers} list="declined" />
    </article>
  );
}
