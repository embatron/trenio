import { createFileRoute } from "@tanstack/react-router";

import { AdminAccountsTable } from "@/components/admin-accounts-table";
import { getAdminAccountsFn } from "@/lib/admin/accounts";

export const Route = createFileRoute("/admin/accounts/")({
  loader: () => getAdminAccountsFn(),
  head: () => ({
    meta: [
      { title: "Аккаунты · кабинет администратора · trenio.by" },
      { name: "description", content: "Все аккаунты trenio.by: пользователи, тренеры, клубы и сотрудники." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminAccountsPage,
});

function AdminAccountsPage() {
  const accounts = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Аккаунты</h2>
      <AdminAccountsTable accounts={accounts} />
    </article>
  );
}
