import { reportClientLogsFn } from "@/lib/log/report.functions";
import type { ClientLogEvent } from "@/lib/log/client-schema";

const queue: ClientLogEvent[] = [];
let timer: number | undefined;
let silent = false;
let installed = false;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function ownPath(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return parsed.pathname;
  } catch {
    return null;
  }
}

function skipPath(path: string): boolean {
  if (path.includes("reportClientLogs")) return true;
  if (path.startsWith("/@") || path.startsWith("/src/") || path.includes("/node_modules/")) return true;
  return /\.(?:js|css|map|png|jpe?g|webp|svg|gif|ico|woff2?|avif)$/i.test(path);
}

function requestIdFrom(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function domainFor(page: string, path: string): ClientLogEvent["domain"] {
  if (page.startsWith("/map") || /map/i.test(path)) return "map";
  if (/geo|visitor/i.test(path)) return "geo";
  return "ajax";
}

function enqueue(event: ClientLogEvent): void {
  if (queue.length >= 8) queue.shift();
  queue.push(event);
  if (timer != null) return;
  timer = window.setTimeout(() => {
    timer = undefined;
    void flush();
  }, 1500);
}

async function flush(): Promise<void> {
  if (silent || queue.length === 0) return;
  const events = queue.splice(0, 8);
  silent = true;
  try {
    await reportClientLogsFn({ data: { events } });
  } catch {
    /* the journal must not break the page */
  } finally {
    silent = false;
  }
}

export function reportClientEvent(event: ClientLogEvent): void {
  if (typeof window === "undefined") return;
  enqueue(event);
}

export function installClientLogReporter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientEvent({
      domain: "client",
      level: "error",
      action: "client.error",
      message: (event.message || "window error").slice(0, 500),
      route: window.location.pathname,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : "unhandled rejection";
    reportClientEvent({
      domain: "client",
      level: "error",
      action: "client.rejection",
      message: message.slice(0, 500),
      route: window.location.pathname,
    });
  });

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (silent) return original(input, init);
    const url = requestUrl(input);
    const path = ownPath(url);
    const started = performance.now();
    try {
      const response = await original(input, init);
      if (path && !skipPath(path) && response.status >= 500) {
        reportClientEvent({
          domain: domainFor(window.location.pathname, path),
          level: "error",
          action: "ajax.http",
          message: `${(init?.method ?? "GET").toUpperCase()} ${path} ${response.status}`.slice(0, 500),
          route: window.location.pathname,
          statusCode: response.status,
          durationMs: Math.round(performance.now() - started),
          requestId: requestIdFrom(response.headers.get("x-request-id")),
        });
      }
      return response;
    } catch (error) {
      if (path && !skipPath(path)) {
        reportClientEvent({
          domain: domainFor(window.location.pathname, path),
          level: "error",
          action: "ajax.network",
          message: `${(init?.method ?? "GET").toUpperCase()} ${path} network`.slice(0, 500),
          route: window.location.pathname,
          durationMs: Math.round(performance.now() - started),
        });
      }
      throw error;
    }
  };
}
