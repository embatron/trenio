import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import type { PublicUser } from "@/lib/auth/schemas";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installClientLogReporter, reportClientEvent } from "@/lib/log/client-reporter";
import { CatalogMiss } from "@/components/catalog-miss";
import { FavoritesProvider } from "@/components/favorites-store";
import { MessagesLive } from "@/components/messages/messages-live";
import { Toaster } from "@/components/ui/sonner";
import { getSessionFn } from "@/lib/auth/functions";
import { unreadCountFn } from "@/lib/messages/functions";
import { EMPTY_MESSAGING, type MessagingSummary } from "@/lib/messages/schemas";

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { status?: unknown; statusCode?: unknown };
  if (typeof record.status === "number") return record.status;
  if (typeof record.statusCode === "number") return record.statusCode;
  return undefined;
}

function NotFoundComponent() {
  return (
    <CatalogMiss
      code="404"
      title="Мяч ушёл за линию"
      text="Такой страницы нет. Выберите вид спорта и город — найдём тренера."
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportClientEvent({
      domain: "client",
      level: "error",
      action: "client.boundary",
      message: error.message.slice(0, 500) || "route error",
      route: window.location.pathname,
    });
  }, [error]);

  if (httpStatus(error) === 403) {
    return (
      <CatalogMiss
        code="403"
        title="Сюда без пропуска"
        text="Эта страница закрыта. Каталог, карта и поиск остаются открытыми."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: PublicUser | null;
  messaging: MessagingSummary;
}>()({
  beforeLoad: async () => {
    const user = await getSessionFn();
    if (!user) return { user, messaging: EMPTY_MESSAGING };
    try {
      const messaging = await unreadCountFn({ data: {} });
      return { user, messaging };
    } catch (error) {
      const { logCaught } = await import("@/lib/log/logger");
      logCaught("message", "message.unread", error);
      return { user, messaging: EMPTY_MESSAGING };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f04b50" },
      { title: "Найти тренера в Беларуси | trenio.by" },
      { name: "description", content: "Тренеры в Беларуси по виду спорта и городу. Цена, формат и контакты." },
      { name: "author", content: "trenio.by" },
      { property: "og:title", content: "Найти тренера в Беларуси | trenio.by" },
      { property: "og:description", content: "Тренеры в Беларуси по виду спорта и городу." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_BY" },
      { property: "og:site_name", content: "trenio.by" },
      { property: "og:image", content: "https://trenio.by/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "trenio.by" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, user, messaging } = Route.useRouteContext();
  useEffect(() => {
    installClientLogReporter();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FavoritesProvider userId={user?.id ?? null}>
        <MessagesLive userId={user?.id ?? null} initial={messaging}>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </MessagesLive>
      </FavoritesProvider>
    </QueryClientProvider>
  );
}
