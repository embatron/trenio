import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";

import { CabinetModal } from "@/components/cabinet";
import { PageStatusCard } from "@/components/trainer-cabinet-pulse";
import { TrainerContactStatus, TrainerIdentityFields } from "@/components/trainer-contact-status";
import { TrainerProfileForm } from "@/components/trainer-profile-form";

const meRoute = getRouteApi("/me");

export const Route = createFileRoute("/me/profile")({
  head: () => ({
    meta: [
      { title: "Моя страница · Я ищу тренера на trenio.by" },
      { name: "description", content: "Публичная карточка тренера." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MeProfilePage,
});

function ActivationWelcome() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("created") !== "1") return;
    setOpen(true);
  }, []);
  function close() {
    setOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (!params.has("created")) return;
    params.delete("created");
    const query = params.toString();
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }
  if (!open) return null;
  return (
    <CabinetModal onClick={close}>
      <div
        className="cabinet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-created-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-created-title">Ваш аккаунт активирован</h2>
        <p>Страница опубликована и уже видна другим пользователям. Вы можете редактировать собственный контент, фотографии, тексты и добавлять контакты.</p>
        <button type="button" onClick={close}>Понятно</button>
      </div>
    </CabinetModal>
  );
}

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
        <h2>Моя страница</h2>
        <p className="cabinet-empty">Карточка в каталоге к этому аккаунту пока не привязана.</p>
      </article>
    );
  }

  return (
    <>
      <article className="cabinet-card" id="trainer-name">
        <h2>Имя и заголовок</h2>
        <TrainerIdentityFields profile={trainer} />
      </article>
      <PageStatusCard status={trainer.pageStatus} />
      <article className="cabinet-card" id="trainer-contact-block">
        <h2>Контакты</h2>
        <TrainerContactStatus profile={trainer} />
      </article>
      <article
        className={enterCard ? "cabinet-card profile-card-enter" : "cabinet-card"}
        onAnimationEnd={() => {
          try { localStorage.setItem("trenio-trainer-profile-card", "1"); } catch { /* ignore */ }
        }}
      >
        <h2>Моя страница</h2>
        <TrainerProfileForm profile={trainer} />
        <ActivationWelcome />
      </article>
    </>
  );
}
