import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PhotoImage } from "@/components/photo-image";
import { ACCOUNT_STATUS_LABEL, getAdminAccountFn } from "@/lib/admin/accounts";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const Route = createFileRoute("/admin/accounts/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.id)) throw notFound();
    const account = await getAdminAccountFn({ data: { id: params.id } });
    if (!account) throw notFound();
    return account;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name || "Клиент"} · профиль · trenio.by` },
      { name: "description", content: "Профиль клиента, который оставил отзыв." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminAccountPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function AdminAccountPage() {
  const account = Route.useLoaderData();
  const name = account.name || "Без имени";

  return (
    <article className="cabinet-card">
      <h2>Профиль клиента</h2>
      <div className="cabinet-account">
        <div className="cabinet-person">
          {account.avatarPath ? (
            <PhotoImage className="cabinet-person__mark" src={account.avatarPath} alt="" preset="avatar" width={44} height={44} />
          ) : (
            <span className="cabinet-person__mark" aria-hidden="true">{name.slice(0, 1)}</span>
          )}
          <div>
            <strong>{name}</strong>
            <span>{displayAccountLogin(account.email)}</span>
          </div>
        </div>
      </div>
      <dl className="cabinet-facts">
        <div>
          <dt>Почта</dt>
          <dd>{displayAccountLogin(account.email)}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>{account.phone || "не указан"}</dd>
        </div>
        <div>
          <dt>Роли</dt>
          <dd>{account.roles.map((item) => ROLE_LABELS[item]).join(", ") || "без роли"}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{ACCOUNT_STATUS_LABEL[account.status] ?? account.status}</dd>
        </div>
        <div>
          <dt>Регистрация</dt>
          <dd>{formatDate(account.createdAt)}</dd>
        </div>
        {account.trainers.length > 0 ? (
          <div>
            <dt>Карточка тренера</dt>
            <dd>
              {account.trainers.map((trainer) => (
                <span key={trainer.slug}>
                  <Link to="/admin/trainers/$slug" params={{ slug: trainer.slug }} target="_blank" rel="noopener noreferrer">{trainer.fullName}</Link>
                  {trainer.status === "published" ? (
                    <>
                      {" · "}
                      <Link to="/trainers/$slug" params={{ slug: trainer.slug }} target="_blank" rel="noopener noreferrer">в каталоге</Link>
                    </>
                  ) : null}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
