import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { ConversationThread, type ThreadMessage } from "@/components/messages/conversation-thread";
import { DIRECT_CSS } from "@/components/messages/messages-workspace";
import { TablePager, useTablePage } from "@/components/table-pager";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  blockPairFn,
  closeConversationFn,
  dismissReportFn,
  listMessagesFn,
  listReportsFn,
  reopenConversationFn,
} from "@/lib/messages/functions";
import type { ReportRow } from "@/lib/messages/schemas";

const STATUS_LABEL = {
  new: "Новая",
  reviewed: "Разобрана",
  dismissed: "Отклонена",
} as const;

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [
      { title: "Сообщения · кабинет администратора · trenio.by" },
      { name: "description", content: "Жалобы на сообщения." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listReportsFn);
  const messagesFn = useServerFn(listMessagesFn);
  const dismissFn = useServerFn(dismissReportFn);
  const blockFn = useServerFn(blockPairFn);
  const closeFn = useServerFn(closeConversationFn);
  const reopenFn = useServerFn(reopenConversationFn);
  const [status, setStatus] = useState<"" | ReportRow["status"]>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => listFn({ data: {} }),
  });
  const visible = useMemo(
    () => (reports.data ?? []).filter((row) => !status || row.status === status),
    [reports.data, status],
  );
  const pager = useTablePage(visible, status);
  const opened = (reports.data ?? []).find((row) => row.id === openId) ?? null;
  const thread = useQuery({
    queryKey: ["messages", opened?.conversationId, "staff"],
    queryFn: () => messagesFn({ data: { conversationId: opened!.conversationId } }),
    enabled: Boolean(opened),
  });

  async function act(id: string, action: () => Promise<unknown>, done?: string) {
    setBusy(id);
    setError(null);
    try {
      await action();
      if (done) toast(done);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await thread.refetch();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const messages: ThreadMessage[] = (thread.data?.messages ?? []).slice().reverse();

  return (
    <article className="cabinet-card">
      <h2>Жалобы на сообщения</h2>
      {reports.isPending ? <p className="cabinet-empty">Загрузка…</p> : reports.error ? (
        <p className="cabinet-empty">{authErrorMessage(reports.error)}</p>
      ) : (reports.data ?? []).length === 0 ? <p className="cabinet-empty">Жалоб пока нет.</p> : (
        <>
          <div className="cabinet-filters">
            <label>
              <span>Статус</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as "" | ReportRow["status"])}>
                <option value="">Все статусы</option>
                <option value="new">Новые</option>
                <option value="reviewed">Разобранные</option>
                <option value="dismissed">Отклонённые</option>
              </select>
            </label>
          </div>
          {error ? <p className="cabinet-empty">{error}</p> : null}
          {visible.length === 0 ? <p className="cabinet-empty">Нет жалоб с таким фильтром.</p> : (
            <>
              <div className="cabinet-table-wrap">
                <table className="cabinet-table">
                  <thead>
                    <tr>
                      <th>Кто пожаловался</th>
                      <th>Тренер</th>
                      <th>Сообщение</th>
                      <th>Причина</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className="cabinet-inline-link" to="/admin/accounts/$id" params={{ id: row.reporterId }}>{row.reporterName}</Link>
                        </td>
                        <td>
                          <Link className="cabinet-inline-link" to="/trainers/$slug" params={{ slug: row.trainerSlug }}>{row.trainerName}</Link>
                        </td>
                        <td>{row.preview}</td>
                        <td>{row.reason}</td>
                        <td><span className={`cabinet-status cabinet-status--${row.status === "new" ? "pending" : row.status === "reviewed" ? "published" : "rejected"}`}>{STATUS_LABEL[row.status]}</span></td>
                        <td>
                          <div className="cabinet-actions">
                            <button type="button" onClick={() => setOpenId(row.id)}>Открыть</button>
                            <button type="button" disabled={busy === row.id || row.status === "dismissed"} onClick={() => void act(row.id, () => dismissFn({ data: { reportId: row.id } }))}>Отклонить</button>
                            <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, () => closeFn({ data: { conversationId: row.conversationId } }))}>Закрыть</button>
                            <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, () => blockFn({ data: { conversationId: row.conversationId } }), "Пара заблокирована, диалог закрыт")}>Блок</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
            </>
          )}
          {opened ? (
            <div className="direct-admin-thread">
              <ConversationThread
                view="inbox"
                thread={thread.data ?? null}
                messages={messages}
                loading={thread.isPending}
                error={thread.error ? authErrorMessage(thread.error) : null}
                hasEarlier={false}
                loadingEarlier={false}
                onEarlier={() => undefined}
                onSend={async () => undefined}
                onRetry={() => undefined}
                onReport={async () => undefined}
                onClose={() => void act(opened.id, () => closeFn({ data: { conversationId: opened.conversationId } }))}
                onReopen={() => void act(opened.id, () => reopenFn({ data: { conversationId: opened.conversationId } }))}
                onBlock={() => void act(opened.id, () => blockFn({ data: { conversationId: opened.conversationId } }), "Пара заблокирована, диалог закрыт")}
                busy={busy === opened.id}
              />
            </div>
          ) : null}
        </>
      )}
      <style>{`${DIRECT_CSS} .direct-admin-thread { margin: 16px; min-height: 480px; } .cabinet-actions button { min-height: 44px; }`}</style>
    </article>
  );
}
