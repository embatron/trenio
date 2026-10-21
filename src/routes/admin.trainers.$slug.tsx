import { createFileRoute, notFound } from "@tanstack/react-router";

import { AdminTrainerPage } from "@/components/admin-trainer-page";
import { getAdminTrainerDetailFn } from "@/lib/admin/trainers";

export const Route = createFileRoute("/admin/trainers/$slug")({
  loader: async ({ params }) => {
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
