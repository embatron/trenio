import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { AdminTrainersTable } from "@/components/admin-trainers-table";
import { isActiveTrainer, isDraftQueue, staysUnclear, getAdminTrainersFn } from "@/lib/admin/trainers";

const LISTS = ["all", "unvisited", "published", "unclear", "declined"] as const;
type TrainerListTab = (typeof LISTS)[number];

const TABS: Array<{ id: TrainerListTab; label: string }> = [
  { id: "all", label: "Весь список" },
  { id: "unvisited", label: "Драфты" },
  { id: "published", label: "Активные" },
  { id: "unclear", label: "Непонятные" },
  { id: "declined", label: "Отказались" },
];

export const Route = createFileRoute("/admin/trainers/")({
  validateSearch: (search: Record<string, unknown>): { list?: Exclude<TrainerListTab, "all"> } => {
    const raw = typeof search.list === "string" ? search.list : "";
    if (raw === "unvisited" || raw === "published" || raw === "unclear" || raw === "declined") return { list: raw };
    return {};
  },
  loader: () => getAdminTrainersFn(),
  head: () => ({
    meta: [
      { title: "Тренеры · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Карточки тренеров: весь список, драфты, активные, непонятные и отказались." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminTrainersPage,
});

function AdminTrainersPage() {
  const { trainers } = Route.useLoaderData();
  const list = Route.useSearch().list ?? "all";
  const navigate = useNavigate();
  const counts = useMemo(() => ({
    all: trainers.length,
    unvisited: trainers.filter(isDraftQueue).length,
    published: trainers.filter(isActiveTrainer).length,
    unclear: trainers.filter(staysUnclear).length,
    declined: trainers.filter((trainer) => trainer.status === "declined").length,
  }), [trainers]);

  return (
    <article className="cabinet-card">
      <h2>Тренеры</h2>
      <div className="cabinet-tabs" role="tablist" aria-label="Списки тренеров">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={list === tab.id}
            onClick={() => {
              void navigate({
                to: "/admin/trainers",
                search: tab.id === "all" ? {} : { list: tab.id },
              });
            }}
          >
            {`${tab.label} (${counts[tab.id]})`}
          </button>
        ))}
      </div>
      <AdminTrainersTable key={list} trainers={trainers} list={list === "all" ? "all" : list} />
    </article>
  );
}
