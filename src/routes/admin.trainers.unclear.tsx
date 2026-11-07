import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/unclear")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Непонятные · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Первое сообщение отправлено и заход был, а карточку не забрали и не опубликовали." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminUnclearTrainersPage,
});

function AdminUnclearTrainersPage() {
  const { trainers, outreachText } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Непонятные</h2>
      <p className="cabinet-note cabinet-note--lede">
        Первое сообщение уже отправлено и заход был, а карточку не забрали и не опубликовали.
      </p>
      <AdminTrainersTable trainers={trainers} outreachText={outreachText} list="unclear" />
    </article>
  );
}
