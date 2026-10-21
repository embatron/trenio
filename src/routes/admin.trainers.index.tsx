import { createFileRoute } from "@tanstack/react-router";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { getAdminTrainersFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/")({
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Тренеры · кабинет администратора · trenio.by" },
      { name: "description", content: "Профили тренеров, статус публикации и привязанный аккаунт." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminTrainersPage,
});

function AdminTrainersPage() {
  const trainers = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Тренеры</h2>
      <AdminTrainersTable trainers={trainers} />
    </article>
  );
}
