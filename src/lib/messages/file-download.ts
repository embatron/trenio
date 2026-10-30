import { eq } from "drizzle-orm";

import { findValidSession } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { getDb } from "@/db";
import { messageAttachments, messages } from "@/db/schema";
import { isAuthError } from "@/lib/auth/errors";
import { isStaff } from "@/lib/auth/roles";
import { readMessageFile, readMessagePreview } from "@/lib/messages/attachment-store";
import { logCaught } from "@/lib/log/logger";
import { requireConversation } from "@/lib/messages/service";

function plain(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8" },
  });
}

function missing() {
  return plain(404, "Не найдено.");
}

function disposition(name: string, mime: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "") || "file";
  const kind = mime.startsWith("image/") ? "inline" : "attachment";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function sendMessageFile(id: string, preview = false): Promise<Response> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return missing();
  try {
    const token = readSessionToken();
    const user = token ? await findValidSession(token) : null;
    if (!user) return plain(401, "Требуется авторизация.");
    const [row] = await getDb()
      .select({
        conversationId: messageAttachments.conversationId,
        messageId: messageAttachments.messageId,
        name: messageAttachments.originalName,
        mime: messageAttachments.mime,
        ext: messageAttachments.ext,
        deletedAt: messages.deletedAt,
      })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(eq(messageAttachments.id, id))
      .limit(1);
    if (!row?.messageId) return missing();
    await requireConversation({ id: user.id, roles: user.roles }, row.conversationId, "read");
    if (row.deletedAt && !isStaff(user.roles)) return missing();
    const image = row.mime.startsWith("image/");
    let bytes: Buffer;
    let mime = row.mime;
    let name = row.name;
    if (preview && image) {
      try {
        bytes = await readMessagePreview(row.conversationId, id);
        mime = "image/jpeg";
        name = "preview.jpg";
      } catch {
        bytes = await readMessageFile(row.conversationId, id, row.ext);
      }
    } else {
      bytes = await readMessageFile(row.conversationId, id, row.ext);
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mime,
        "content-length": String(bytes.length),
        "content-disposition": disposition(name, mime),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (!isAuthError(error)) logCaught("message", "message.file", error, { target: id });
    return missing();
  }
}
