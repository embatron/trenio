import { createFileRoute, redirect } from "@tanstack/react-router";

import { ExpiredLink } from "@/components/expired-link";
import { authErrorMessage } from "@/lib/auth/errors";
import { enterTrainerDoorFn, peekTrainerMailFn } from "@/lib/catalog/trainer-magic";

export const Route = createFileRoute("/hi/$code")({
  head: () => ({
    meta: [
      { title: "Ссылка · Я ищу тренера на trenio.by" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  loader: async ({ params, location }) => {
    const mail = new URLSearchParams(location.searchStr).get("mail") ?? "";
    if (mail) {
      const peek = await peekTrainerMailFn({ data: { code: params.code, token: mail } });
      if (!peek) return { ready: false };
      const door = await enterTrainerDoorFn({ data: { code: params.code } });
      if (!door) return { ready: false };
      const query = new URLSearchParams({ mail, door: params.code });
      throw redirect({ href: `/trainers/${door.slug}?${query.toString()}` });
    }
    const door = await enterTrainerDoorFn({ data: { code: params.code } });
    if (!door) return { ready: false };
    throw redirect({ to: "/trainers/$slug", params: { slug: door.slug } });
  },
  component: DoorPage,
  errorComponent: DoorError,
});

function DoorError({ error }: { error: unknown }) {
  const text = authErrorMessage(error);
  const friendly = !text || text === "Invalid" || text.startsWith("Произошла ошибка");
  return <ExpiredLink text={friendly ? "Такой ссылки нет. Попросите новую в сообщении из Instagram." : text} />;
}

function DoorPage() {
  const { ready } = Route.useLoaderData();
  if (!ready) return <ExpiredLink text="Такой ссылки нет. Попросите новую в сообщении из Instagram." />;
  return <ExpiredLink text="Ссылка уже не действует." />;
}
