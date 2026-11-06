import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { TablePager, useTablePage } from "@/components/table-pager";
import { getAdminWelcomesFn, type AdminWelcome } from "@/lib/admin/welcomes";

const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";

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

function ContactLine({
  href,
  label,
  name,
  external,
  phone,
  icon,
}: {
  href: string;
  label: string;
  name: string;
  external?: boolean;
  phone?: boolean;
  icon: ReactNode;
}) {
  return (
    <a
      className={phone ? "welcome-contact welcome-contact--phone" : "welcome-contact"}
      href={href}
      aria-label={name}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <span className="welcome-contact__mark">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

function ContactCell({ welcome }: { welcome: AdminWelcome }) {
  const lines = [
    welcome.instagram ? (
      <ContactLine
        key="ig"
        href={`https://www.instagram.com/${welcome.instagram}/`}
        label={welcome.instagram}
        name={`Instagram ${welcome.instagram}`}
        external
        icon={<InstagramIcon />}
      />
    ) : null,
    welcome.telegram ? (
      <ContactLine
        key="tg"
        href={`https://t.me/${welcome.telegram}`}
        label={`@${welcome.telegram}`}
        name={`Telegram @${welcome.telegram}`}
        external
        icon={<TelegramIcon />}
      />
    ) : null,
    welcome.phone ? (
      <ContactLine
        key="phone"
        href={`tel:${welcome.phone.replace(/[^\d+]/g, "")}`}
        label={welcome.phone}
        name={`Телефон ${welcome.phone}`}
        phone
        icon={
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={PHONE_PATH} />
          </svg>
        }
      />
    ) : null,
  ].filter(Boolean);
  if (lines.length === 0) return "—";
  return <span className="welcome-contacts">{lines}</span>;
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
        .welcome-contacts { display: grid; justify-items: start; }
        .welcome-contact { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: var(--text); font-size: 14px; font-weight: var(--fw-body); line-height: 1.3; text-decoration: none; white-space: nowrap; }
        .welcome-contact__mark { width: 22px; height: 22px; display: grid; place-items: center; flex: 0 0 22px; }
        .welcome-contact__mark svg { width: 20px; height: 20px; display: block; }
        .welcome-contact--phone svg { fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
        .welcome-contact:hover { color: var(--primary); }
      `,
        }}
      />
    </article>
  );
}
