import { createFileRoute, useRouteContext } from "@tanstack/react-router";

import { AccountProfileForm } from "@/components/account-profile-form";
import { getAdminSettingsFn } from "@/lib/admin/settings";

export const Route = createFileRoute("/admin/settings")({
  loader: () => getAdminSettingsFn(),
  head: () => ({
    meta: [
      { title: "Параметры · кабинет администратора · trenio.by" },
      { name: "description", content: "Имя, почта, телефон и пароль аккаунта администратора." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const data = Route.useLoaderData();
  const { user } = useRouteContext({ from: "__root__" });
  if (!user) return null;

  return (
    <article className="cabinet-card">
      <h2>Параметры</h2>
      <AccountProfileForm user={user} phone={data.phone} phoneVerified={data.phoneVerified} />
    </article>
  );
}
