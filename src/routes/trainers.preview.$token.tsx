import { createFileRoute, redirect } from "@tanstack/react-router";

import { ExpiredLink } from "@/components/expired-link";
import { openTrainerPreviewFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/trainers/preview/$token")({
  head: () => ({
    meta: [
      { title: "Профиль тренера · trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params }) => {
    const opened = await openTrainerPreviewFn({ data: { token: params.token } });
    if (opened) throw redirect({ to: "/trainers/$slug", params: { slug: opened.slug } });
    return { ok: false as const };
  },
  component: PreviewMissing,
});

function PreviewMissing() {
  return <ExpiredLink text="Такой ссылки нет. Попросите новую в сообщении от trenio.by." />;
}
