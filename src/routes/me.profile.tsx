import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { TrainerProfileForm } from "@/components/trainer-profile-form";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/profile")({
  head: () => ({
    meta: [
      { title: "Профиль · trenio.by" },
      { name: "description", content: "Публичная карточка тренера." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeProfilePage,
});

function MeProfilePage() {
  const { trainer } = meRoute.useLoaderData();
  const [enterCard, setEnterCard] = useState(false);
  useLayoutEffect(() => {
    const key = "trenio-trainer-profile-card";
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; } catch { seen = true; }
    if (seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      return;
    }
    setEnterCard(true);
  }, []);
  if (!trainer) {
    return (
      <article className="cabinet-card">
        <h2>Профиль</h2>
        <p className="cabinet-empty">Карточка в каталоге к этому аккаунту пока не привязана.</p>
      </article>
    );
  }

  return (
    <article
      className={enterCard ? "cabinet-card profile-card-enter" : "cabinet-card"}
      onAnimationEnd={() => {
        try { localStorage.setItem("trenio-trainer-profile-card", "1"); } catch { /* ignore */ }
      }}
    >
      <h2>Профиль</h2>
      <TrainerProfileForm profile={trainer} />
    </article>
  );
}
