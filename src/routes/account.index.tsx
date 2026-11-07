import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";

import { membershipDays } from "@/lib/account/membership";
import { countRu, pluralRu } from "@/lib/ru-plural";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "Профиль · Я ищу тренера на trenio.by" },
      { name: "description", content: "Сколько вы с нами, отзывы, избранное и переписки." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountProfilePage,
});

function sinceLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Minsk",
  }).format(new Date(value));
}

function AccountProfilePage() {
  const { user } = accountRoute.useRouteContext();
  const { cabinet } = accountRoute.useLoaderData();
  if (!user) return null;

  const days = membershipDays(new Date(cabinet.createdAt), new Date());
  const since = sinceLabel(cabinet.createdAt);
  const sentence = days === 0
    ? `Сегодня ваш первый день на trenio.by, ${since}.`
    : `Вы с нами ${countRu(days, "день", "дня", "дней")}, с ${since}.`;
  const pending = cabinet.reviews.filter((review) => review.status === "pending").length;
  const published = cabinet.reviews.filter((review) => review.status === "published").length;
  const needsName = !user.firstName.trim() || user.firstName.trim() === "Пользователь";
  const phone = !cabinet.phone
    ? "Телефон не указан."
    : cabinet.phoneVerified
      ? `Телефон ${cabinet.phone} подтверждён.`
      : `Телефон ${cabinet.phone} ждёт подтверждения.`;

  return (
    <>
      <div className="cabinet-stats">
        <Link to="/account/reviews" className="cabinet-stat">
          <strong>{cabinet.reviews.length}</strong>
          <span>{pluralRu(cabinet.reviews.length, "отзыв", "отзыва", "отзывов")}</span>
        </Link>
        <Link to="/account/favorites" className="cabinet-stat">
          <strong>{cabinet.favoriteCount}</strong>
          <span>в избранном</span>
        </Link>
        <Link to="/account/messages" className="cabinet-stat">
          <strong>{cabinet.conversationCount}</strong>
          <span>{pluralRu(cabinet.conversationCount, "переписка", "переписки", "переписок")}</span>
        </Link>
      </div>
      <article className="cabinet-card">
        <h2>Профиль</h2>
        <p className="cabinet-note cabinet-note--lede">{sentence}</p>
        <ul className="cabinet-facts">
          <li>{cabinet.emailVerified ? "Почта подтверждена." : "Почта ещё не подтверждена."}</li>
          <li>{phone}</li>
          <li>
            {published > 0
              ? `${countRu(published, "отзыв", "отзыва", "отзывов")} ${pluralRu(published, "опубликован", "опубликованы", "опубликовано")}.`
              : "Опубликованных отзывов пока нет."}
          </li>
          {pending > 0 ? <li>{countRu(pending, "отзыв на модерации", "отзыва на модерации", "отзывов на модерации")}.</li> : null}
          {needsName ? <li>Имя и фамилия пока не заполнены. Их можно указать в настройках.</li> : null}
          {!user.avatarPath ? <li>Своего фото ещё нет. Его можно добавить в настройках.</li> : null}
        </ul>
      </article>
    </>
  );
}
