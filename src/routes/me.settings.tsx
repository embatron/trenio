import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AccountProfileForm } from "@/components/account-profile-form";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/settings")({
  head: () => ({
    meta: [
      { title: "Настройки · trenio.by" },
      { name: "description", content: "Имя и фамилия аккаунта." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeSettingsPage,
});

function MeSettingsPage() {
  const { cabinet, trainer } = meRoute.useLoaderData();
  const { user } = meRoute.useRouteContext();
  if (!user) return null;
  const face = trainer?.photos[0] || trainer?.avatarPath || null;

  return (
    <article className="cabinet-card">
      <h2>Настройки</h2>
      <AccountProfileForm user={user} phone={cabinet.phone} phoneVerified={cabinet.phoneVerified} profilePhoto={face} />
    </article>
  );
}
