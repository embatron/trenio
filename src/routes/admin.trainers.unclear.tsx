import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/unclear")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Непонятные · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Заход уже был, карточку не опубликовали." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminUnclearTrainersPage,
});

function AdminUnclearTrainersPage() {
  const { trainers } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Непонятные</h2>
      <p className="cabinet-note cabinet-note--lede">
        Заход уже был, карточку не опубликовали.
      </p>
      <AdminTrainersTable trainers={trainers} list="unclear" />
    </article>
  );
}
