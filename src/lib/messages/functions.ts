// upgrade path: PartyKit self-hosted, schema unchanged.
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { AuthError, isAuthError } from "@/lib/auth/errors";
import { z } from "zod";

import {
  conversationIdSchema,
  dismissReportSchema,
  ensureConversationSchema,
  listConversationsSchema,
  listMessagesSchema,
  listReportsSchema,
  markConversationReadSchema,
  reportMessageSchema,
  sendMessageSchema,
} from "@/lib/messages/schemas";
import { writeLog } from "@/lib/log/logger";
import {
  blockPair,
  closeConversation,
  dismissReport,
  ensureConversation,
  hideConversation,
  listConversations,
  listMessages,
  listReports,
  markConversationRead,
  reopenConversation,
  reportMessage,
  sendMessage,
  unreadSummary,
} from "@/lib/messages/service";

function rethrowMessage(
  error: unknown,
  action: string,
  actorUserId: string,
  target?: string | null,
  context?: Record<string, unknown>,
): never {
  void writeLog({
    level: isAuthError(error) ? "warn" : "error",
    domain: "message",
    action,
    outcome: isAuthError(error) && (error.code === "FORBIDDEN" || error.code === "RATE_LIMITED") ? "denied" : "failure",
    message: isAuthError(error) ? error.message : "Сбой переписки.",
    actorUserId,
    target,
    error,
    context,
  });
  if (isAuthError(error)) throw error;
  throw new AuthError("Не удалось выполнить действие. Попробуйте ещё раз.", "VALIDATION");
}

function logMessage(action: string, actorUserId: string, message: string, target?: string | null, context?: Record<string, unknown>) {
  void writeLog({
    level: "info",
    domain: "message",
    action,
    outcome: "success",
    message,
    actorUserId,
    target,
    context,
  });
}

export const listConversationsFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(listConversationsSchema)
  .handler(async ({ data, context }) => {
    try {
      return await listConversations(context.user, data);
    } catch (error) {
      rethrowMessage(error, "message.list", context.user.id);
    }
  });

export const listMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(listMessagesSchema)
  .handler(async ({ data, context }) => {
    try {
      return await listMessages(context.user, data);
    } catch (error) {
      rethrowMessage(error, "message.thread", context.user.id, data.conversationId);
    }
  });

export const ensureConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(ensureConversationSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await ensureConversation(context.user, data.trainerProfileSlug);
      logMessage("message.ensure", context.user.id, "Переписка открыта.", result.conversationId, {
        trainer: data.trainerProfileSlug,
      });
      return result;
    } catch (error) {
      rethrowMessage(error, "message.ensure", context.user.id, data.trainerProfileSlug);
    }
  });

export const sendMessageFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(sendMessageSchema)
  .handler(async ({ data, context }) => {
    const target = data.conversationId ?? data.trainerProfileSlug ?? null;
    try {
      const result = await sendMessage(context.user, data);
      logMessage("message.send", context.user.id, "Сообщение сохранено.", target, { chars: data.body.length });
      return result;
    } catch (error) {
      rethrowMessage(error, "message.send", context.user.id, target, { chars: data.body.length });
    }
  });

export const markConversationReadFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(markConversationReadSchema)
  .handler(async ({ data, context }) => {
    try {
      return await markConversationRead(context.user, data);
    } catch (error) {
      rethrowMessage(error, "message.read", context.user.id, data.conversationId);
    }
  });

export const closeConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await closeConversation(context.user, data.conversationId);
      logMessage("message.close", context.user.id, "Переписка закрыта.", data.conversationId);
      return result;
    } catch (error) {
      rethrowMessage(error, "message.close", context.user.id, data.conversationId);
    }
  });

export const reopenConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await reopenConversation(context.user, data.conversationId);
      logMessage("message.reopen", context.user.id, "Переписка открыта снова.", data.conversationId);
      return result;
    } catch (error) {
      rethrowMessage(error, "message.reopen", context.user.id, data.conversationId);
    }
  });

export const hideConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      return await hideConversation(context.user, data.conversationId);
    } catch (error) {
      rethrowMessage(error, "message.hide", context.user.id, data.conversationId);
    }
  });

export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(reportMessageSchema)
  .handler(async ({ data, context }) => {
    const reason = /^[a-z_]{1,32}$/.test(data.reason) ? data.reason : null;
    try {
      const result = await reportMessage(context.user, data);
      logMessage("message.report", context.user.id, "Жалоба записана.", String(data.messageId), {
        reason,
        reasonLength: data.reason.length,
      });
      return result;
    } catch (error) {
      rethrowMessage(error, "message.report", context.user.id, String(data.messageId), { reasonLength: data.reason.length });
    }
  });

export const listReportsFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(listReportsSchema)
  .handler(async ({ data, context }) => {
    try {
      const rows = await listReports(context.user);
      return data.status ? rows.filter((row) => row.status === data.status) : rows;
    } catch (error) {
      rethrowMessage(error, "message.reports", context.user.id);
    }
  });

export const dismissReportFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(dismissReportSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await dismissReport(context.user, data.reportId);
      logMessage("message.dismiss", context.user.id, "Жалоба отклонена.", data.reportId);
      return result;
    } catch (error) {
      rethrowMessage(error, "message.dismiss", context.user.id, data.reportId);
    }
  });

export const blockPairFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await blockPair(context.user, data.conversationId);
      logMessage("message.block", context.user.id, "Пара заблокирована.", data.conversationId);
      return result;
    } catch (error) {
      rethrowMessage(error, "message.block", context.user.id, data.conversationId);
    }
  });

export const unreadCountFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({}))
  .handler(async ({ context }) => {
    try {
      return await unreadSummary(context.user.id);
    } catch (error) {
      rethrowMessage(error, "message.unread", context.user.id);
    }
  });
