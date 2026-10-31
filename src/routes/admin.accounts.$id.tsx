import { createFileRoute, notFound } from "@tanstack/react-router";

import { AdminAccountPage } from "@/components/admin-account-page";
import { getAdminAccountFn } from "@/lib/admin/accounts";
import { isAccountId } from "@/lib/auth/god";

export const Route = createFileRoute("/admin/accounts/$id")({
  loader: async ({ params }) => {
    if (!isAccountId(params.id)) throw notFound();
    const account = await getAdminAccountFn({ data: { id: params.id } });
    if (!account) throw notFound();
    return account;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name || "Аккаунт"} · кабинет администратора · trenio.by` },
      { name: "description", content: "Профиль аккаунта, входы и журнал действий." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: () => {
    const account = Route.useLoaderData();
    return <AdminAccountPage account={account} />;
  },
});
