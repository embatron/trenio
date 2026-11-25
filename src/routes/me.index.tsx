import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { useCabinetLive } from "@/components/cabinet-live";
import { TrainerOverviewRating } from "@/components/trainer-cabinet-pulse";
import { mergeCabinetInterest } from "@/lib/cabinet/live";
import { POPULARITY_MAX } from "@/lib/catalog/trainer-popularity";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/")({
  head: () => ({
    meta: [
      { title: "Панель и статистика · личный кабинет тренера · Я ищу тренера на trenio.by" },
      { name: "description", content: `Панель и статистика: рейтинг вашего профиля от 0 до ${POPULARITY_MAX}, посещения, показы, лайкосы и переходы.` },
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
