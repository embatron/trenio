import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CabinetOpenMark } from "@/components/cabinet";
import { useCabinetLive } from "@/components/cabinet-live";
import { UserAvatar } from "@/components/user-avatar";
import { listOwnAccountLikesFn, type AccountLikeHistoryItem } from "@/lib/catalog/account-likes";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Minsk",
});

export const Route = createFileRoute("/me/likes")({
  head: () => ({
    meta: [
      { title: "Мои лайкосы · Я ищу тренера на trenio.by" },
      { name: "description", content: "Кто залайкосил профиль и каким карточкам тренер поставил лайкос." },
      NOINDEX_FOLLOW,
    ],
  }),
  loader: () => listOwnAccountLikesFn(),
  component: MeLikesPage,
});

function MeLikesPage() {
  const loaded = Route.useLoaderData();
  const live = useCabinetLive();
  const received = live?.history?.received ?? loaded.received;
  const given = live?.history?.given ?? loaded.given;
  const [tab, setTab] = useState<"received" | "given">("received");
  const rows = tab === "received" ? received : given;

  return (
    <article className="cabinet-card">
      <h2>Мои лайкосы</h2>
      <div className="cabinet-tabs" role="tablist" aria-label="Лайкосы">
        <button type="button" role="tab" aria-selected={tab === "received"} onClick={() => setTab("received")}>
          Кто меня залайкосил
          <span className="cabinet-tab__count">{received.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "given"} onClick={() => setTab("given")}>
          Мои лайкосы
          <span className="cabinet-tab__count">{given.length}</span>
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="cabinet-empty">{tab === "received" ? "Пока лайкосов нет." : "Вы ещё не ставили лайкос."}</p>
      ) : (
        <div>
          {rows.map((row) => (
            <HistoryRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </article>
  );
}

function HistoryRow({ row }: { row: AccountLikeHistoryItem }) {
  const name = row.slug ? (
    <Link className="cabinet-id__line" to="/trainers/$slug" params={{ slug: row.slug }} target="_blank" rel="noreferrer" title="Открыть страницу">
      <strong>{row.name}</strong>
      <CabinetOpenMark />
    </Link>
  ) : (
    <strong>{row.name}</strong>
  );
  return (
    <div className="cabinet-row">
      <div className="cabinet-row__who">
        <span className="cabinet-like-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
        </span>
        <UserAvatar name={row.name} src={row.avatar} size={40} />
        <div>{name}</div>
      </div>
      <time dateTime={row.at}>{when.format(new Date(row.at))}</time>
    </div>
  );
}
