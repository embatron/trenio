import { createFileRoute, getRouteApi, useRouteContext } from "@tanstack/react-router";

import { AccountProfileForm } from "@/components/account-profile-form";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/settings")({
  head: () => ({
    meta: [
      { title: "Параметры · trenio.by" },
      { name: "description", content: "Имя и фамилия аккаунта." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { cabinet } = accountRoute.useLoaderData();
  const { user } = useRouteContext({ from: "__root__" });
  if (!user) return null;

  return (
    <article className="cabinet-card">
      <h2>Параметры</h2>
      <AccountProfileForm user={user} phone={cabinet.phone} phoneVerified={cabinet.phoneVerified} />
    </article>
  );
}
