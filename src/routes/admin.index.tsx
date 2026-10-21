import { createFileRoute, Link } from "@tanstack/react-router";

import { getAdminOverviewFn } from "@/lib/admin/overview";
import { pluralRu } from "@/lib/ru-plural";

export const Route = createFileRoute("/admin/")({
  loader: () => getAdminOverviewFn(),
  head: () => ({
    meta: [
      { title: "Обзор · кабинет администратора · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const data = Route.useLoaderData();

  return (
    <>
      <div className="cabinet-stats">
        <div className="cabinet-stat">
          <strong>{data.trainersTotal}</strong>
          <span>{pluralRu(data.trainersTotal, "тренер", "тренера", "тренеров")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.reviewsTotal}</strong>
          <span>{pluralRu(data.reviewsTotal, "отзыв", "отзыва", "отзывов")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.reviewsPending}</strong>
          <span>{pluralRu(data.reviewsPending, "отзыв на модерации", "отзыва на модерации", "отзывов на модерации")}</span>
        </div>
        <div className="cabinet-stat">
          <strong>{data.accountsTotal}</strong>
          <span>{pluralRu(data.accountsTotal, "аккаунт", "аккаунта", "аккаунтов")}</span>
        </div>
      </div>
      <p className="cabinet-note">Интерфейс тренера открывается отдельно: <Link to="/trainer-admin">кабинет тренера</Link>.</p>
    </>
  );
}
