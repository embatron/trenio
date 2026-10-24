import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { TablePager, useTablePage } from "@/components/table-pager";
import { TrainerName } from "@/components/trainer-name";
import { UserAvatar } from "@/components/user-avatar";
import { ACCOUNT_STATUS_LABEL, type AdminAccountDetail } from "@/lib/admin/accounts";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { ROLE_LABELS } from "@/lib/auth/roles";

const TABS = [
  { id: "profile", label: "Профиль" },
  { id: "logins", label: "Входы" },
  { id: "logs", label: "Логи" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(value: string) {
  return value ? when.format(new Date(value)) : "—";
}

export function AdminAccountPage({ account }: { account: AdminAccountDetail }) {
  const [tab, setTab] = useState<TabId>("profile");
  const name = account.name || "Без имени";
  const logins = useTablePage(account.logins);
  const logs = useTablePage(account.logs);

  return (
    <article className="cabinet-card">
      <h2>
        <TrainerName firstName={account.firstName} lastName={account.lastName} empty="Без имени" />
      </h2>
      <div className="cabinet-tabs" role="tablist" aria-label="Аккаунт">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <>
          <div className="cabinet-account">
            <div className="cabinet-person">
              <UserAvatar name={name} src={account.avatarPath} size={44} />
              <div>
                <strong>
                  <TrainerName firstName={account.firstName} lastName={account.lastName} empty="Без имени" />
                </strong>
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
              <dt>Почта подтверждена</dt>
              <dd>{formatWhen(account.emailVerifiedAt)}</dd>
            </div>
            <div>
              <dt>Телефон подтверждён</dt>
              <dd>{formatWhen(account.phoneVerifiedAt)}</dd>
            </div>
            <div>
              <dt>Регистрация</dt>
              <dd>{formatWhen(account.createdAt)}</dd>
            </div>
            <div>
              <dt>Последний вход</dt>
              <dd>{formatWhen(account.lastLoginAt)}</dd>
            </div>
            {account.trainers.length > 0 ? (
              <div>
                <dt>Карточка тренера</dt>
                <dd>
                  {account.trainers.map((trainer) => (
                    <span key={trainer.slug}>
                      <Link to="/admin/trainers/$slug" params={{ slug: trainer.slug }} target="_blank" rel="noopener noreferrer">
                        <TrainerName firstName={trainer.firstName} lastName={trainer.lastName} empty={trainer.slug} />
                      </Link>
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
          <p className="cabinet-note">
            <Link to="/admin/accounts">К списку аккаунтов</Link>
          </p>
        </>
      ) : null}
      {tab === "logins" ? (
        account.logins.length === 0 ? (
          <p className="cabinet-empty">Входов пока нет.</p>
        ) : (
          <>
            <div className="cabinet-table-wrap">
              <table className="cabinet-table">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Статус</th>
                    <th>IP</th>
                    <th>Устройство</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.rows.map((login) => (
                    <tr key={login.id}>
                      <td>{formatWhen(login.createdAt)}</td>
                      <td>{login.active ? "Сессия открыта" : "Сессия закрыта"}</td>
                      <td>{login.ip}</td>
                      <td>{login.userAgent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager page={logins.page} pages={logins.pages} total={logins.total} from={logins.from} to={logins.to} onPage={logins.setPage} />
          </>
        )
      ) : null}
      {tab === "logs" ? (
        account.logs.length === 0 ? (
          <p className="cabinet-empty">Событий пока нет.</p>
        ) : (
          <>
            <div className="cabinet-table-wrap">
              <table className="cabinet-table">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Событие</th>
                    <th>Подробности</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.rows.map((entry, index) => (
                    <tr key={`${entry.at}-${entry.title}-${index}`}>
                      <td>{formatWhen(entry.at)}</td>
                      <td>{entry.title}</td>
                      <td>{entry.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager page={logs.page} pages={logs.pages} total={logs.total} from={logs.from} to={logs.to} onPage={logs.setPage} />
          </>
        )
      ) : null}
    </article>
  );
}
