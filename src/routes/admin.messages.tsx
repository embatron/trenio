import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationThread, type ThreadMessage } from "@/components/messages/conversation-thread";
import type { ComposerFile } from "@/components/messages/message-composer";
import { DIRECT_CSS } from "@/components/messages/messages-workspace";
import { TablePager, useTablePage } from "@/components/table-pager";
import { useIsMobile } from "@/hooks/use-mobile";
import { authErrorMessage } from "@/lib/auth/errors";
import { newMessageClientId } from "@/lib/messages/attachments";
import {
  blockPairFn,
  closeConversationFn,
  dismissReportFn,
  listConversationsFn,
  listMessagesFn,
  listReportsFn,
  markConversationReadFn,
  reopenConversationFn,
  sendMessageFn,
  uploadMessageFileFn,
} from "@/lib/messages/functions";
import { CONVERSATION_POLL_MS, THREAD_POLL_MS, visiblePollInterval } from "@/lib/messages/polling";
import type { ConversationCursor, ConversationListItem, ReportRow } from "@/lib/messages/schemas";

const STATUS_LABEL = {
  new: "Новая",
  reviewed: "Разобрана",
  dismissed: "Отклонена",
} as const;

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [
      { title: "Сообщения · кабинет администратора · trenio.by" },
      { name: "description", content: "Переписки и жалобы на них." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AdminMessagesPage,
});

function countLabel(value: number | undefined, pending: boolean) {
  return pending ? "…" : String(value ?? 0);
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Файл не прочитан."));
    reader.readAsDataURL(file);
  });
}

function AdminMessagesPage() {
  const conversationsFn = useServerFn(listConversationsFn);
  const reportsFn = useServerFn(listReportsFn);
  const [tab, setTab] = useState<"threads" | "reports">("threads");
  const threads = useQuery({
    queryKey: ["conversations", "staff"],
    queryFn: () => conversationsFn({ data: { view: "staff" } }),
    refetchInterval: visiblePollInterval(CONVERSATION_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsFn({ data: {} }),
  });

  return (
    <article className="cabinet-card">
      <div className="cabinet-tabs" role="tablist" aria-label="Сообщения">
        <button type="button" role="tab" aria-selected={tab === "threads"} onClick={() => setTab("threads")}>
          {`Переписки (${countLabel(threads.data?.total, threads.isPending)})`}
        </button>
        <button type="button" role="tab" aria-selected={tab === "reports"} onClick={() => setTab("reports")}>
          {`Жалобы (${countLabel(reports.data?.length, reports.isPending)})`}
        </button>
      </div>
      {tab === "threads" ? <StaffThreads /> : <ReportQueue reports={reports.data ?? []} pending={reports.isPending} error={reports.error} />}
      <style>{DIRECT_CSS}</style>
    </article>
  );
}

function StaffThreads() {
  const mobile = useIsMobile();
  const listFn = useServerFn(listConversationsFn);
  const messagesFn = useServerFn(listMessagesFn);
  const sendFn = useServerFn(sendMessageFn);
  const uploadFn = useServerFn(uploadMessageFileFn);
  const markFn = useServerFn(markConversationReadFn);
  const closeFn = useServerFn(closeConversationFn);
  const reopenFn = useServerFn(reopenConversationFn);
  const blockFn = useServerFn(blockPairFn);
  const [openId, setOpenId] = useState<string | null>(null);
  const [extra, setExtra] = useState<ConversationListItem[]>([]);
  const [cursor, setCursor] = useState<ConversationCursor | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["conversations", "staff"],
    queryFn: () => listFn({ data: { view: "staff" } }),
    refetchInterval: visiblePollInterval(CONVERSATION_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const thread = useQuery({
    queryKey: ["messages", openId, "staff"],
    queryFn: () => messagesFn({ data: { conversationId: openId! } }),
    enabled: Boolean(openId),
    refetchInterval: visiblePollInterval(THREAD_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const items = useMemo(() => {
    const first = list.data?.items ?? [];
    const seen = new Set(first.map((item) => item.id));
    return [...first, ...extra.filter((item) => !seen.has(item.id))];
  }, [list.data?.items, extra]);
  const latestId = items[0]?.id ?? null;
  useEffect(() => {
    if (mobile || openId || list.isPending || !latestId) return;
    setOpenId(latestId);
  }, [mobile, openId, list.isPending, latestId]);
  const newestId = thread.data?.messages[0]?.id ?? 0;
  useEffect(() => {
    if (!openId || !newestId || !thread.data?.canReport) return;
    void markFn({ data: { conversationId: openId, lastMessageId: newestId } }).catch(() => undefined);
  }, [openId, newestId, thread.data?.canReport, markFn]);
  const next = cursor === undefined ? list.data?.nextCursor ?? null : cursor;
  const messages: ThreadMessage[] = (thread.data?.messages ?? []).slice().reverse();

  async function send(body: string, files: ComposerFile[] = []) {
    if (!openId || !thread.data?.canWrite) return;
    const clientId = newMessageClientId();
    setBusy(true);
    setError(null);
    try {
      const attachmentIds: string[] = [];
      for (const file of files) {
        const dataUrl = await readDataUrl(file.file);
        const saved = await uploadFn({
          data: { id: file.id, conversationId: openId, clientId, fileName: file.name, dataUrl },
        });
        attachmentIds.push(saved.id);
      }
      await sendFn({ data: { conversationId: openId, body, clientId, attachmentIds } });
      await thread.refetch();
      await list.refetch();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: () => Promise<unknown>, done?: string) {
    if (!openId) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (done) toast(done);
      await thread.refetch();
      await list.refetch();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`direct${mobile ? " is-mobile" : ""}${mobile && openId ? " is-thread" : ""}`}>
      <ConversationList
        view="staff"
        items={items}
        activeId={openId}
        loading={list.isPending}
        error={list.error ? authErrorMessage(list.error) : null}
        hasMore={Boolean(next)}
        loadingMore={loadingMore}
        onOpen={setOpenId}
        onMore={() => {
          if (!next) return;
          setLoadingMore(true);
          void listFn({ data: { view: "staff", cursor: next } })
            .then((page) => {
              setExtra((current) => [...current, ...page.items]);
              setCursor(page.nextCursor);
            })
            .catch((err) => setError(authErrorMessage(err)))
            .finally(() => setLoadingMore(false));
        }}
      />
      <ConversationThread
        view="inbox"
        thread={openId ? thread.data ?? null : null}
        messages={openId ? messages : []}
        loading={Boolean(openId) && thread.isPending}
        error={error ?? (thread.error ? authErrorMessage(thread.error) : null)}
        hasEarlier={false}
        loadingEarlier={false}
        onEarlier={() => undefined}
        onSend={send}
        onRetry={() => undefined}
        onReport={async () => undefined}
        onClose={() => void act(() => closeFn({ data: { conversationId: openId! } }))}
        onReopen={() => void act(() => reopenFn({ data: { conversationId: openId! } }))}
        onBlock={() => void act(() => blockFn({ data: { conversationId: openId! } }), "Пара заблокирована, диалог закрыт")}
        busy={busy}
        onBack={() => setOpenId(null)}
      />
    </div>
  );
}

function ReportQueue({
  reports,
  pending,
  error,
}: {
  reports: ReportRow[];
  pending: boolean;
  error: unknown;
}) {
  const queryClient = useQueryClient();
  const messagesFn = useServerFn(listMessagesFn);
  const dismissFn = useServerFn(dismissReportFn);
  const blockFn = useServerFn(blockPairFn);
  const closeFn = useServerFn(closeConversationFn);
  const reopenFn = useServerFn(reopenConversationFn);
  const [status, setStatus] = useState<"" | ReportRow["status"]>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const visible = useMemo(
    () => reports.filter((row) => !status || row.status === status),
    [reports, status],
  );
  const pager = useTablePage(visible, status);
  const opened = reports.find((row) => row.id === openId) ?? null;
  const thread = useQuery({
    queryKey: ["messages", opened?.conversationId, "staff-report"],
    queryFn: () => messagesFn({ data: { conversationId: opened!.conversationId } }),
    enabled: Boolean(opened),
  });

  async function act(id: string, action: () => Promise<unknown>, done?: string) {
    setBusy(id);
    setActionError(null);
    try {
      await action();
      if (done) toast(done);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await thread.refetch();
    } catch (err) {
      setActionError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const messages: ThreadMessage[] = (thread.data?.messages ?? []).slice().reverse();
  if (pending) return <p className="cabinet-empty">Загрузка…</p>;
  if (error) return <p className="cabinet-empty">{authErrorMessage(error)}</p>;
  if (reports.length === 0) return <p className="cabinet-empty">Жалоб пока нет.</p>;

  return (
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
      {actionError ? <p className="cabinet-empty">{actionError}</p> : null}
      {visible.length === 0 ? <p className="cabinet-empty">Нет жалоб с таким фильтром.</p> : (
        <>
          <div className="cabinet-table-wrap">
            <table className="cabinet-table">
              <thead>
                <tr>
                  <th>Кто пожаловался</th>
                  <th>Тренер</th>
                  <th>Переписка</th>
                  <th>Причина</th>
                  <th>Комментарий</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="cabinet-inline-link" to="/admin/accounts/$id" params={{ id: row.reporterId }}>{row.reporterName}</Link>
                      <span className="cabinet-report-side">{row.reporterSide === "trainer" ? "Тренер" : "Клиент"}</span>
                    </td>
                    <td>
                      {row.trainerSlug ? (
                        <Link className="cabinet-inline-link" to="/trainers/$slug" params={{ slug: row.trainerSlug }}>{row.trainerName}</Link>
                      ) : (
                        row.trainerName
                      )}
                    </td>
                    <td>{row.preview}</td>
                    <td>{row.reason}</td>
                    <td className="cabinet-report-comment">{row.comment}</td>
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
          <p className="cabinet-report-note">
            <strong>{opened.reporterSide === "trainer" ? "Тренер" : "Клиент"} · {opened.reason}.</strong> {opened.comment}
          </p>
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
      <style>{`.direct-admin-thread { margin: 16px; min-height: 480px; } .cabinet-actions button { min-height: 44px; } .cabinet-report-side { display: block; color: var(--muted); font-size: 12px; } .cabinet-report-comment, .cabinet-report-note { white-space: pre-wrap; overflow-wrap: anywhere; } .cabinet-report-comment { max-width: 280px; } .cabinet-report-note { margin: 0 0 12px; }`}</style>
    </>
  );
}
