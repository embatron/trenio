import { createFileRoute, redirect } from "@tanstack/react-router";

import { ExpiredLink } from "@/components/expired-link";
import { openTrainerEditFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/edit/$token")({
  head: () => ({
    meta: [
      { title: "Редактирование профиля · Я ищу тренера на trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params }) => {
    const opened = await openTrainerEditFn({ data: { token: params.token } });
    if (!opened) return { ok: false as const };
    if (opened.published) throw redirect({ to: "/trainers/$slug", params: { slug: opened.slug } });
    throw redirect({ to: "/trainers/revise" });
  },
  component: EditMissing,
});

function EditMissing() {
  return <ExpiredLink text="Такой ссылки нет. Попросите новую в сообщении от trenio.by." />;
}
