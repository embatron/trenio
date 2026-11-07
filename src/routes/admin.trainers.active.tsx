import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/active")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Активные · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Опубликованные карточки тренеров." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminActiveTrainersPage,
});

function AdminActiveTrainersPage() {
  const { trainers, outreachText } = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Активные</h2>
      <p className="cabinet-note cabinet-note--lede">Опубликованные карточки.</p>
      <AdminTrainersTable trainers={trainers} outreachText={outreachText} list="published" />
    </article>
  );
}
