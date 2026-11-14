import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { GA_MEASUREMENT_ID, YM_COUNTER_ID, googleAnalyticsSnippet, yandexMetrikaSnippet } from "@/lib/seo/analytics";
import { SITE_NAME, siteTitle } from "@/lib/seo/site";
import appCss from "../styles.css?url";
import type { PublicUser } from "@/lib/auth/schemas";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installClientLogReporter, reportClientEvent } from "@/lib/log/client-reporter";
import { NativeAppChrome } from "@/components/mobile/mobile-tab-bar";
import { bootNativeShell } from "@/lib/native/shell";
import { shellClassName } from "@/lib/mobile/detect";
import { currentShellKind, rememberAndroidShell } from "@/lib/mobile/shell-runtime";
import { CatalogMiss } from "@/components/catalog-miss";
import { TelegramAppChrome } from "@/components/telegram-tab-bar";
import { AccountLikesProvider } from "@/components/account-likes-store";
import { FavoritesProvider } from "@/components/favorites-store";
import { canPlaceAccountLike } from "@/lib/catalog/account-like-rules";
import { listPublicLikeCountsFn } from "@/lib/catalog/account-likes";
import { listFavoritesFn } from "@/lib/catalog/favorites";
import { CabinetLive } from "@/components/cabinet-live";
import { MessagesLive } from "@/components/messages/messages-live";
import { CopyLinkToast } from "@/components/share-profile";
import { Toaster } from "@/components/ui/sonner";
import { isAuthorizationRequired } from "@/lib/auth/errors";
import { accountGatePath, gateAllowsPath } from "@/lib/auth/auth-decisions";
import { getSessionFn } from "@/lib/auth/functions";
import { redirectToLogin } from "@/lib/auth/return-path";
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

function AuthorizationRedirect() {
  useEffect(() => {
    redirectToLogin();
  }, []);
  return null;
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  const auth = isAuthorizationRequired(error);
  const forbidden = httpStatus(error) === 403;
  useEffect(() => {
    if (auth || forbidden) return;
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportClientEvent({
      domain: "client",
      level: "error",
      action: "client.boundary",
      message: error.message.slice(0, 500) || "route error",
      route: window.location.pathname,
    });
    const timer = window.setTimeout(() => window.location.reload(), 8000);
    return () => window.clearTimeout(timer);
  }, [auth, error, forbidden]);

  if (auth) return <AuthorizationRedirect />;
  if (forbidden) {
    return (
      <CatalogMiss
        code="403"
        title="Сюда без пропуска"
        text="Эта страница закрыта. Каталог, карта и поиск остаются открытыми."
      />
    );
  }

  return (
    <main className="maintain-screen">
      <style>{MAINTAIN_CSS}</style>
      <p className="maintain-screen__kicker">Обновление</p>
      <h1>Сайт на минуту закрыт</h1>
      <p className="maintain-screen__lead">Обновляем trenio.by. Подождите немного: страница откроется сама.</p>
    </main>
  );
}

const MAINTAIN_CSS = `
.maintain-screen {
  position: fixed; inset: 0; z-index: 80; box-sizing: border-box;
  width: 100%; height: 100%; min-height: 100dvh;
  display: grid; place-items: center; align-content: center; justify-items: center;
  margin: 0; text-align: center; color: #fff;
  padding:
    max(28px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right))
    max(28px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  background:
    radial-gradient(circle at calc(100% - 12px) 22px, #ffd166 0 36px, transparent 38px),
    linear-gradient(145deg, #ff6a4a 0%, #f04b50 46%, #9b1d3a 100%);
}
.maintain-screen::before {
  content: ""; position: fixed; inset: auto -8% -30% 40%; height: 70%;
  border: 18px solid rgba(255, 255, 255, 0.16); border-radius: 50%; pointer-events: none;
}
.maintain-screen__kicker {
  position: relative; display: inline-block; margin: 0 0 16px; padding: 6px 12px;
  border-radius: 999px; background: rgba(255, 255, 255, 0.16); color: #fff;
  font-size: 13px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase;
}
.maintain-screen h1 {
  position: relative; margin: 0 auto 12px; max-width: 12ch; color: #fff;
  font-size: clamp(32px, 4.4vw, 48px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05;
}
.maintain-screen__lead {
  position: relative; margin: 0 auto; max-width: 36ch; color: rgba(255, 255, 255, 0.9); font-size: 16px; line-height: 1.5;
}
@media (max-width: 720px) {
  .maintain-screen::before { inset: auto -46% -48% 18%; height: 70%; border-width: 14px; }
}
`;

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: PublicUser | null;
  messaging: MessagingSummary;
  likeCounts: Record<string, number>;
  /** `null` means the list was not loaded with the page, so the client fetches it. */
  favoriteKeys: string[] | null;
}>()({
  beforeLoad: async ({ location }) => {
    const [user, likeCounts] = await Promise.all([
      getSessionFn(),
      listPublicLikeCountsFn().then((result) => result.counts).catch(() => ({})),
    ]);
    if (!user) return { user, messaging: EMPTY_MESSAGING, likeCounts, favoriteKeys: null };
    const gate = accountGatePath(user);
    if (gate && !gateAllowsPath(location.pathname, gate)) {
      throw redirect({ to: gate });
    }
    const [messaging, favoriteKeys] = await Promise.all([
      unreadCountFn({ data: {} }).catch(() => EMPTY_MESSAGING),
      listFavoritesFn().then((result) => result.keys).catch(() => null),
    ]);
    return { user, messaging, likeCounts, favoriteKeys };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { name: "theme-color", content: "#f04b50" },
      { title: siteTitle("Найти тренера в Беларуси") },
      { name: "description", content: "Тренеры в Беларуси по виду спорта и городу. Цена, формат и контакты." },
      { name: "author", content: SITE_NAME },
      { property: "og:title", content: siteTitle("Найти тренера в Беларуси") },
      { property: "og:description", content: "Тренеры в Беларуси по виду спорта и городу." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_BY" },
      { property: "og:image", content: "https://trenio.by/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
  const [kind, setKind] = useState(() => currentShellKind());
  useLayoutEffect(() => {
    rememberAndroidShell();
    setKind(currentShellKind());
  }, []);
  return (
    <html lang="ru" className={shellClassName(kind) || undefined}>
      <head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: googleAnalyticsSnippet() }} />
        <script dangerouslySetInnerHTML={{ __html: yandexMetrikaSnippet() }} />
        <HeadContent />
      </head>
      <body>
        <noscript>
          <div>
            <img
              src={`https://mc.yandex.ru/watch/${YM_COUNTER_ID}`}
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, user, messaging, likeCounts, favoriteKeys } = Route.useRouteContext();
  useEffect(() => {
    installClientLogReporter();
  }, []);
  useEffect(() => {
    void bootNativeShell(user?.id ?? null);
  }, [user?.id]);

  return (
    <QueryClientProvider client={queryClient}>
      <FavoritesProvider userId={user?.id ?? null} initialKeys={favoriteKeys}>
        <AccountLikesProvider
          userId={user?.id ?? null}
          enabled={Boolean(user && canPlaceAccountLike(user.roles))}
          counts={likeCounts}
        >
          <MessagesLive userId={user?.id ?? null} initial={messaging}>
            <CabinetLive userId={user?.id ?? null}>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <TelegramAppChrome />
              <NativeAppChrome />
              <Toaster />
              <CopyLinkToast />
            </CabinetLive>
          </MessagesLive>
        </AccountLikesProvider>
      </FavoritesProvider>
    </QueryClientProvider>
  );
}
