import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { TrainerReviewsPanel } from "@/components/trainer-reviews-panel";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/reviews")({
  head: () => ({
    meta: [
      { title: "Отзывы · trenio.by" },
      { name: "description", content: "Отзывы о профиле тренера." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeReviewsPage,
});

function MeReviewsPage() {
  const { trainer, reviews } = meRoute.useLoaderData();

  return (
    <article className="cabinet-card">
      <h2>Отзывы</h2>
      {trainer ? <TrainerReviewsPanel reviews={reviews} /> : <p className="cabinet-empty">Карточка ещё не привязана, поэтому отзывов нет.</p>}
    </article>
  );
}
