import { createFileRoute } from "@tanstack/react-router";

import { getAdminFinanceFn } from "@/lib/admin/finance";

export const Route = createFileRoute("/admin/finance")({
  loader: () => getAdminFinanceFn(),
  head: () => ({
    meta: [
      { title: "Бухгалтерия · кабинет администратора · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminFinancePage,
});

function AdminFinancePage() {
  const data = Route.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Бухгалтерия</h2>
      {data.payments.length === 0 ? (
        <p className="cabinet-empty">Платежи, тарифы и выплаты появятся здесь. Раздел в разработке.</p>
      ) : null}
    </article>
  );
}
