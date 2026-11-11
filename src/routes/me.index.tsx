import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { useCabinetLive } from "@/components/cabinet-live";
import { TrainerOverviewRating } from "@/components/trainer-cabinet-pulse";
import { mergeCabinetInterest } from "@/lib/cabinet/live";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/")({
  head: () => ({
    meta: [
      { title: "Общая панель · личный кабинет тренера · Я ищу тренера на trenio.by" },
      { name: "description", content: "Общая панель: рейтинг вашего профиля от 0 до 100." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeOverviewPage,
});

function MeOverviewPage() {
  const { trainer, views, ratings } = meRoute.useLoaderData();
  const live = useCabinetLive();
  return (
    <TrainerOverviewRating
      trainer={trainer}
      views={live?.pulse ?? views}
      ratings={mergeCabinetInterest(ratings, trainer?.slug, live?.interest ?? null)}
    />
  );
}
