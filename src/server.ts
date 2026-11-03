import "./lib/error-capture";

import { getRequest } from "@tanstack/react-start/server";

import { ensureAuthSchema } from "@/auth/auth-schema";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { logCaught, setLogRequestReader, wasLogged, writeLog } from "./lib/log/logger";

setLogRequestReader(() => {
  const request = getRequest();
  return {
    url: request.url,
    method: request.method,
    ipHeader: request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
});

let readyLogged = false;

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body.slice(0, 300)}`);
  if (!wasLogged(error)) logCaught("system", "system.ssr", error);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (!readyLogged) {
      readyLogged = true;
      void writeLog({
        level: "info",
        domain: "system",
        action: "system.ready",
        outcome: "success",
        message: "Процесс сервера принимает запросы.",
      });
    }
    try {
      await ensureAuthSchema();
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      if (!wasLogged(error)) logCaught("system", "system.ssr", error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
