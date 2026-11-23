import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logCaught, wasLogged } from "./lib/log/logger";
import { handleTelegramMenuWebhook, telegramWebhookPath } from "./lib/telegram/webhook.server";
import { handleMobileApi } from "./lib/mobile/http";
import { settleCabinetEntry } from "./lib/catalog/cabinet-entry.server";

const mobileApiMiddleware = createMiddleware().server(async ({ request, next }) => {
  const handled = await handleMobileApi(request);
  if (handled) return handled;
  return next();
});

const telegramMenuMiddleware = createMiddleware().server(async ({ request, next }) => {
  const { pathname } = new URL(request.url);
  if (pathname === telegramWebhookPath() && request.method === "POST") {
    return handleTelegramMenuWebhook(request);
  }
  return next();
});

const PREVIEW_HTML = "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>Кабинет</title></head><body></body></html>";

const cabinetDeskMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  const desk = url.searchParams.get("desk") ?? "";
  const code = /^\/hi\/([23456789abcdefghijkmnpqrstuvwxyz]{8})$/.exec(url.pathname)?.[1];
  if (!desk || !code || (request.method !== "GET" && request.method !== "HEAD")) return next();
  const settled = await settleCabinetEntry(code, desk, request);
  if (settled.kind === "redirect") {
    return new Response(null, {
      status: 302,
      headers: {
        location: settled.href,
        "set-cookie": settled.setCookie,
        "cache-control": "private, no-store",
      },
    });
  }
  if (settled.kind === "preview") {
    return new Response(request.method === "HEAD" ? null : PREVIEW_HTML, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const response = await next();
    if (response instanceof Response && !response.headers.has("x-request-id")) {
      try {
        response.headers.set("x-request-id", crypto.randomUUID());
      } catch {
        /* a locked response still reaches the client */
      }
    }
    return response;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (!wasLogged(error)) logCaught("system", "system.unhandled", error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [mobileApiMiddleware, telegramMenuMiddleware, cabinetDeskMiddleware, errorMiddleware],
}));
