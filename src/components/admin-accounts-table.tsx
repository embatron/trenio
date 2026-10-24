import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { TablePager, useTablePage } from "@/components/table-pager";
import { TrainerName } from "@/components/trainer-name";
import { UserAvatar } from "@/components/user-avatar";
import { ACCOUNT_STATUS_LABEL, type AdminAccount } from "@/lib/admin/accounts";
import { displayAccountLogin } from "@/lib/auth/login-name";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
const PROFILE_ICON = "M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6";

const ACCOUNT_STATUSES = ["pending_verification", "active", "suspended"] as const;

function accountStatusClass(status: string) {
  if (status === "active") return "published";
  if (status === "pending_verification") return "pending";
  return "rejected";
}

function searchHaystack(account: AdminAccount) {
  return [
    account.name,
    account.email,
    displayAccountLogin(account.email),
    account.phone,
    account.phone.replace(/\D/g, ""),
    account.roles.map((role) => ROLE_LABELS[role]).join(" "),
    account.roles.join(" "),
    ACCOUNT_STATUS_LABEL[account.status] ?? account.status,
    account.status,
    account.createdAt ? dateFormat.format(new Date(account.createdAt)) : "",
    account.lastLoginAt ? dateFormat.format(new Date(account.lastLoginAt)) : "",
  ].join(" ").toLocaleLowerCase("ru").replaceAll("ё", "е");
}

export function AdminAccountsTable({ accounts }: { accounts: AdminAccount[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [status, setStatus] = useState<"" | (typeof ACCOUNT_STATUSES)[number]>("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "login-desc" | "login-asc" | "name">("date-desc");

  const visible = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е").split(/\s+/).filter(Boolean);
    const rows = accounts.filter((account) => {
      if (role && !account.roles.includes(role)) return false;
      if (status && account.status !== status) return false;
      if (tokens.length) {
        const haystack = searchHaystack(account);
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
    const byName = (a: AdminAccount, b: AdminAccount) => a.name.localeCompare(b.name, "ru") || a.email.localeCompare(b.email, "ru");
    rows.sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "login-desc" || sort === "login-asc") {
        const left = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0;
        const right = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0;
        if (!left && !right) return byName(a, b);
        if (!left) return 1;
        if (!right) return -1;
        return sort === "login-asc" ? left - right : right - left;
      }
      const left = Date.parse(a.createdAt);
      const right = Date.parse(b.createdAt);
      return sort === "date-asc" ? left - right : right - left;
    });
    return rows;
  }, [accounts, query, role, status, sort]);

  const pager = useTablePage(visible, `${query}|${role}|${status}|${sort}`);

  return (
    <>
      <p className="cabinet-note cabinet-note--lede">
        Только подтверждённые входы в сервис. Карточки тренеров без аккаунта смотрите в разделе{" "}
        <Link to="/admin/trainers">Тренеры</Link>.
      </p>
      <div className="cabinet-filters">
        <label className="cabinet-filters__search">
          <span>Поиск</span>
          <input
            type="search"
            value={query}
            placeholder="Имя, почта, телефон, роль"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Роль</span>
          <select value={role} onChange={(event) => setRole(event.target.value as "" | UserRole)}>
            <option value="">Все роли</option>
            {ALL_ROLES.map((item) => (
              <option key={item} value={item}>{ROLE_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Статус</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="">Все статусы</option>
            {ACCOUNT_STATUSES.map((item) => (
              <option key={item} value={item}>{ACCOUNT_STATUS_LABEL[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="date-desc">Сначала новые</option>
            <option value="date-asc">Сначала старые</option>
            <option value="login-desc">Недавний вход</option>
            <option value="login-asc">Давно не входил</option>
            <option value="name">По имени</option>
          </select>
        </label>
      </div>
      {accounts.length === 0 ? (
        <p className="cabinet-empty">Подтверждённых аккаунтов пока нет.</p>
      ) : visible.length === 0 ? (
        <p className="cabinet-empty">Нет аккаунтов с таким фильтром.</p>
      ) : (
        <>
          <div className="cabinet-table-wrap">
            <table className="cabinet-table cabinet-table--accounts">
              <thead>
                <tr>
                  <th>Аккаунт</th>
                  <th>Телефон</th>
                  <th>Роли</th>
                  <th>Статус</th>
                  <th>Регистрация</th>
                  <th>Последний вход</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map((account) => {
                  const name = account.name || "Без имени";
                  return (
                    <tr key={account.id}>
                      <td>
                        <div className="cabinet-person">
                          <UserAvatar name={name} src={account.avatarPath} size={44} />
                          <div className="cabinet-person__text">
                            <Link to="/admin/accounts/$id" params={{ id: account.id }} title={name}>
                              <strong>
                                <TrainerName firstName={account.firstName} lastName={account.lastName} empty="Без имени" />
                              </strong>
                            </Link>
                            <span className="cabinet-person__meta">{displayAccountLogin(account.email)}</span>
                          </div>
                          <div className="cabinet-row-actions">
                            <Link
                              className="cabinet-icon-btn"
                              to="/admin/accounts/$id"
                              params={{ id: account.id }}
                              aria-label="Открыть аккаунт"
                              title="Открыть аккаунт"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PROFILE_ICON} /></svg>
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td>{account.phone || "—"}</td>
                      <td>{account.roles.map((item) => ROLE_LABELS[item]).join(", ") || "без роли"}</td>
                      <td>
                        <span className={`cabinet-status cabinet-status--${accountStatusClass(account.status)}`}>
                          {ACCOUNT_STATUS_LABEL[account.status] ?? account.status}
                        </span>
                      </td>
                      <td>{dateFormat.format(new Date(account.createdAt))}</td>
                      <td>{account.lastLoginAt ? dateFormat.format(new Date(account.lastLoginAt)) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
        </>
      )}
    </>
  );
}
