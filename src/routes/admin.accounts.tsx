import { createFileRoute } from "@tanstack/react-router";

import { getAdminAccountsFn } from "@/lib/admin/accounts";
import { ROLE_LABELS } from "@/lib/auth/roles";

const STATUS_LABEL: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

export const Route = createFileRoute("/admin/accounts")({
  loader: () => getAdminAccountsFn(),
  head: () => ({
    meta: [
      { title: "Аккаунты · кабинет администратора · trenio.by" },
      { name: "description", content: "Аккаунты trenio.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminAccountsPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function AdminAccountsPage() {
  const accounts = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Аккаунты</h2>
      {accounts.length === 0 ? <p className="cabinet-empty">Аккаунтов нет.</p> : (
        <div className="cabinet-table-wrap">
          <table className="cabinet-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Почта</th>
                <th>Роли</th>
                <th>Статус</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.name || "Без имени"}</strong></td>
                  <td>{account.email}</td>
                  <td>{account.roles.map((item) => ROLE_LABELS[item]).join(", ") || "без роли"}</td>
                  <td>{STATUS_LABEL[account.status] ?? account.status}</td>
                  <td>{formatDate(account.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
