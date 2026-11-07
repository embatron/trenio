import { type ReactNode } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";

import { membershipDays } from "@/lib/account/membership";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
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
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Minsk",
  }).format(new Date(value));
  return formatted.replace(/\s*г\.\s*$/, "");
}

function LineIcon({ path }: { path: string }) {
  return (
    <svg className="cabinet-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="cabinet-line" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function VerifiedMark({ label }: { label: string }) {
  return (
    <span className="cabinet-mark cabinet-mark--on cabinet-mark--sign" role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

function ContactRow({
  icon,
  label,
  value,
  verified,
  verifiedLabel,
  waitingLabel,
  missingLabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  verified: boolean | null;
  verifiedLabel: string;
  waitingLabel: string;
  missingLabel: string;
}) {
  return (
    <div className="cabinet-contact">
      <span className="cabinet-contact__icon" aria-hidden="true">{icon}</span>
      <span className="cabinet-contact__body">
        <span className="cabinet-contact__name">{label}</span>
        {value ? <span className="cabinet-contact__value">{value}</span> : null}
      </span>
      <span className="cabinet-contact__marks">
        {verified === true ? <VerifiedMark label={verifiedLabel} /> : null}
        {verified === false ? <span className="cabinet-mark cabinet-mark--wait">{waitingLabel}</span> : null}
        {verified === null ? <span className="cabinet-mark cabinet-mark--off">{missingLabel}</span> : null}
      </span>
    </div>
  );
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
  const email = isPendingSignupEmail(user.email) ? "" : user.email;

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
        <div className="cabinet-contacts">
          <ContactRow
            icon={<MailIcon />}
            label="Почта"
            value={email}
            verified={email ? cabinet.emailVerified : null}
            verifiedLabel="Подтверждена"
            waitingLabel="Не подтверждена"
            missingLabel="Не указана"
          />
          <ContactRow
            icon={<LineIcon path="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" />}
            label="Телефон"
            value={cabinet.phone ?? ""}
            verified={cabinet.phone ? cabinet.phoneVerified : null}
            verifiedLabel="Подтверждён"
            waitingLabel="Не подтверждён"
            missingLabel="Не указан"
          />
        </div>
        <ul className="cabinet-facts">
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
