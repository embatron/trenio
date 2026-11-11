import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { useCabinetLive } from "@/components/cabinet-live";
import { TrainerOwnStats } from "@/components/trainer-cabinet-pulse";
import { mergeCabinetInterest } from "@/lib/cabinet/live";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/stats")({
  head: () => ({
    meta: [
      { title: "Моя статистика · Я ищу тренера на trenio.by" },
      { name: "description", content: "Посещения, показы, лайкосы и переходы по странице тренера." },
      NOINDEX_FOLLOW,
    ],
  }),
  component: MeStatsPage,
});

function MeStatsPage() {
  const { trainer, views, ratings } = meRoute.useLoaderData();
  const live = useCabinetLive();
  return (
    <TrainerOwnStats
      trainer={trainer}
      views={live?.pulse ?? views}
      ratings={mergeCabinetInterest(ratings, trainer?.slug, live?.interest ?? null)}
    />
  );
}
