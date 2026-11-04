import { createFileRoute, redirect } from "@tanstack/react-router";

import { ExpiredLink } from "@/components/expired-link";
import { enterTrainerDoorFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/hi/$code/edit")({
  head: () => ({ meta: [{ title: "Профиль тренера · Я ищу тренера на trenio.by" }, { name: "robots", content: "noindex,follow" }] }),
  loader: async ({ params }) => {
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (door) throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
    return { ok: false as const };
  },
  component: Missing,
});

function Missing() {
  return <ExpiredLink text="Такой ссылки нет. Попросите новую в сообщении из Instagram." />;
}
