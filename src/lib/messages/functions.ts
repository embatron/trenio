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

function rethrowMessage(error: unknown): never {
  if (isAuthError(error)) throw error;
  console.error(error);
  throw new AuthError("Не удалось выполнить действие. Попробуйте ещё раз.", "VALIDATION");
}

export const listConversationsFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(listConversationsSchema)
  .handler(async ({ data, context }) => {
    try {
      return await listConversations(context.user, data);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const listMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(listMessagesSchema)
  .handler(async ({ data, context }) => {
    try {
      return await listMessages(context.user, data);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const ensureConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(ensureConversationSchema)
  .handler(async ({ data, context }) => {
    try {
      return await ensureConversation(context.user, data.trainerProfileSlug);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const sendMessageFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(sendMessageSchema)
  .handler(async ({ data, context }) => {
    try {
      return await sendMessage(context.user, data);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const markConversationReadFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(markConversationReadSchema)
  .handler(async ({ data, context }) => {
    try {
      return await markConversationRead(context.user, data);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const closeConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      return await closeConversation(context.user, data.conversationId);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const reopenConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      return await reopenConversation(context.user, data.conversationId);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const hideConversationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      return await hideConversation(context.user, data.conversationId);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(reportMessageSchema)
  .handler(async ({ data, context }) => {
    try {
      return await reportMessage(context.user, data);
    } catch (error) {
      rethrowMessage(error);
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
      rethrowMessage(error);
    }
  });

export const dismissReportFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(dismissReportSchema)
  .handler(async ({ data, context }) => {
    try {
      return await dismissReport(context.user, data.reportId);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const blockPairFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(conversationIdSchema)
  .handler(async ({ data, context }) => {
    try {
      return await blockPair(context.user, data.conversationId);
    } catch (error) {
      rethrowMessage(error);
    }
  });

export const unreadCountFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({}))
  .handler(async ({ context }) => {
    try {
      return await unreadSummary(context.user.id);
    } catch (error) {
      rethrowMessage(error);
    }
  });
