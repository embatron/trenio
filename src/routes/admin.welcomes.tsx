import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { TablePager, useTablePage } from "@/components/table-pager";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import {
  getAdminWelcomesFn,
  setAdminWelcomeStatusFn,
  type AdminWelcome,
} from "@/lib/admin/welcomes";

const CHECK = "M5 12l5 5L20 7";

const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";

export const Route = createFileRoute("/admin/welcomes")({
  loader: () => getAdminWelcomesFn(),
  head: () => ({
    meta: [
      { title: "Заявки · кабинет администратора · Я ищу тренера на trenio.by" },
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
      {icon}
      {label}
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
  return <div className="welcome-contacts">{lines}</div>;
}

type WelcomeChip = {
  label: string;
  tone: "pending" | "published" | "rejected";
};

function welcomeChip(row: AdminWelcome): WelcomeChip {
  if (row.staffStatus === "rejected") return { label: "Отклонена", tone: "rejected" };
  if (row.trainer?.status === "published") return { label: "Опубликован", tone: "published" };
  if (row.staffStatus === "done") return { label: "Разобрана", tone: "published" };
  if (row.trainer?.status === "hidden" || row.trainer?.status === "archived") {
    return { label: row.trainer.status === "hidden" ? "Скрыт" : "Архив", tone: "rejected" };
  }
  if (row.trainer?.status === "draft") return { label: "Черновик", tone: "pending" };
  if (row.linkOpen) return { label: "Ссылка открыта", tone: "pending" };
  return { label: "Новая", tone: "pending" };
}

function IconButton({
  label,
  path,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  path: string;
  tone: "approve";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`cabinet-icon-btn cabinet-icon-btn--${tone}`}
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}

function AdminWelcomesPage() {
  const rows = Route.useLoaderData();
  const router = useRouter();
  const pager = useTablePage(rows);
  const setStatus = useAuthServerFn(setAdminWelcomeStatusFn);
  const [busyId, setBusyId] = useState<string | null>(null);

  function decide(id: string) {
    setBusyId(id);
    void setStatus({ data: { id, status: "done" } })
      .then(() => router.invalidate())
      .finally(() => setBusyId(null));
  }

  return (
    <article className="cabinet-card">
      <h2>Заявки</h2>
      {rows.length === 0 ? (
        <p className="cabinet-empty">Заявок пока нет.</p>
      ) : (
        <>
          <div className="cabinet-table-wrap">
            <table className="cabinet-table welcome-table">
              <thead>
                <tr>
                  <th>Контакты</th>
                  <th>Тренер</th>
                  <th>Статус</th>
                  <th>Решение</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map((row) => {
                  const chip = welcomeChip(row);
                  return (
                    <tr key={row.id}>
                      <td>
                        <ContactCell welcome={row} />
                      </td>
                      <td>
                        {row.trainer ? (
                          <Link
                            className="cabinet-name-link"
                            to="/admin/trainers/$slug"
                            params={{ slug: row.trainer.slug }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {row.trainer.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="cabinet-status-cell">
                        <div className="cabinet-status-stack">
                          <span className={`cabinet-status cabinet-status--${chip.tone}`}>
                            {chip.label}
                          </span>
                          <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                        </div>
                      </td>
                      <td>
                        <div className="cabinet-actions">
                          {row.staffStatus === "new" ? (
                            <IconButton
                              label="Разобрать"
                              path={CHECK}
                              tone="approve"
                              disabled={busyId === row.id}
                              onClick={() => decide(row.id)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        .welcome-table th, .welcome-table td { padding: 6px 12px; }
        .cabinet-table .welcome-contacts { display: flex; flex-direction: column; align-items: flex-start; }
        .cabinet-table .welcome-contact { display: flex; flex-direction: row; align-items: center; gap: 8px; min-height: 32px; color: var(--text); font-size: 14px; font-weight: var(--fw-body); line-height: 1.3; text-decoration: none; white-space: nowrap; }
        .cabinet-table .welcome-contact svg { width: 18px; height: 18px; flex: 0 0 18px; display: block; }
        .cabinet-table .welcome-contact--phone svg { fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
        .cabinet-table .welcome-contact:hover { color: var(--primary); }
      `,
        }}
      />
    </article>
  );
}
