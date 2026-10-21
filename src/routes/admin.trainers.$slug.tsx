import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { AdminTrainerPage } from "@/components/admin-trainer-page";
import { getAdminTrainerDetailFn } from "@/lib/admin/trainers";
import { TRAINER_LEGACY_SLUGS } from "@/lib/catalog/trainer-slugs";

export const Route = createFileRoute("/admin/trainers/$slug")({
  loader: async ({ params }) => {
    const legacy = TRAINER_LEGACY_SLUGS[params.slug];
    if (legacy) throw redirect({ to: "/admin/trainers/$slug", params: { slug: legacy } });
    const detail = await getAdminTrainerDetailFn({ data: { slug: params.slug } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.trainer.fullName || "Тренер"} · trenio.by` },
      { name: "description", content: "Карточка тренера: поля профиля, входы и события." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminTrainerRoute,
});

function AdminTrainerRoute() {
  const detail = Route.useLoaderData();
  return <AdminTrainerPage key={detail.trainer.slug} detail={detail} />;
}
