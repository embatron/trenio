import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/bookings")({
  head: () => ({
    meta: [
      { title: "Мои записи · trenio.by" },
      { name: "description", content: "Записи на тренировки. Раздел в разработке." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AccountBookingsPage,
});

function AccountBookingsPage() {
  return (
    <article className="cabinet-card">
      <h2>Мои записи</h2>
      <p className="cabinet-empty">Запись на тренировку появится в этом списке. Раздел в разработке.</p>
    </article>
  );
}
