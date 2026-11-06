import { createFileRoute } from "@tanstack/react-router";

import { TablePager, useTablePage } from "@/components/table-pager";
import { getAdminWelcomesFn, type AdminWelcome } from "@/lib/admin/welcomes";

export const Route = createFileRoute("/admin/welcomes")({
  loader: () => getAdminWelcomesFn(),
  head: () => ({
    meta: [
      { title: "Заявки от тренера · кабинет администратора · Я ищу тренера на trenio.by" },
      { name: "description", content: "Заявки со страницы «Стать тренером»." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminWelcomesPage,
});

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Minsk",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ContactLink({ href, children }: { href: string; children: string }) {
  return (
    <a className="cabinet-inline-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function ContactCell({ welcome }: { welcome: AdminWelcome }) {
  const bits = [
    welcome.instagram ? (
      <ContactLink key="ig" href={`https://www.instagram.com/${welcome.instagram}/`}>
        {welcome.instagram}
      </ContactLink>
    ) : null,
    welcome.telegram ? (
      <ContactLink key="tg" href={`https://t.me/${welcome.telegram}`}>
        {`@${welcome.telegram}`}
      </ContactLink>
    ) : null,
    welcome.phone ? (
      <a
        key="phone"
        className="cabinet-inline-link"
        href={`tel:${welcome.phone.replace(/[^\d+]/g, "")}`}
      >
        {welcome.phone}
      </a>
    ) : null,
  ].filter(Boolean);
  if (bits.length === 0) return "—";
  return <span className="welcome-contacts">{bits}</span>;
}

function AdminWelcomesPage() {
  const rows = Route.useLoaderData();
  const pager = useTablePage(rows);

  return (
    <article className="cabinet-card">
      <h2>Заявки от тренера</h2>
      {rows.length === 0 ? (
        <p className="cabinet-empty">Заявок пока нет.</p>
      ) : (
        <>
          <div className="cabinet-table-wrap">
            <table className="cabinet-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Канал</th>
                  <th>Контакты</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatWhen(row.createdAt)}</td>
                    <td>{row.channel === "instagram" ? "Instagram" : "Без Instagram"}</td>
                    <td>
                      <ContactCell welcome={row} />
                    </td>
                    <td>
                      <span
                        className={`cabinet-status ${row.open ? "cabinet-status--pending" : "cabinet-status--published"}`}
                      >
                        {row.open ? "Новая" : "Ссылка открыта"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={pager.page}
            pages={pager.pages}
            total={pager.total}
            from={pager.from}
            to={pager.to}
            onPage={pager.setPage}
          />
        </>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .welcome-contacts { display: flex; flex-wrap: wrap; gap: 4px 12px; }
        .welcome-contacts .cabinet-inline-link { margin-top: 0; }
      `,
        }}
      />
    </article>
  );
}
