import { createFileRoute } from "@tanstack/react-router";

import { googleAuthUrl, googleConfigured, newGoogleState } from "@/auth/google";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { safeReturnPath } from "@/lib/auth/return-path";
import { writeLog } from "@/lib/log/logger";

const COOKIE = "trenio_google_oauth";
const MAX_AGE = 10 * 60;

function cookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function loginRedirect(reason: string, back: string | null, browse = false) {
  const url = new URL("/auth/login", "https://trenio.by");
  url.searchParams.set("google", reason);
  if (back) url.searchParams.set("redirect", back);
  if (browse) url.searchParams.set("browse", "1");
  return new Response(null, {
    status: 302,
    headers: { location: `${url.pathname}${url.search}`, "cache-control": "private, no-store" },
  });
}

export const Route = createFileRoute("/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const back = safeReturnPath(url.searchParams.get("redirect"));
        const door = url.searchParams.get("door") === "1";
        const browse = url.searchParams.get("browse") === "1";
        if (!googleConfigured()) return loginRedirect("failed", back, browse);
        const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
        const limit = await consumeRateLimit(`google:ip:${ip}`, 15 * 60_000, 12);
        if (!limit.ok) {
          void writeLog({
            level: "warn",
            domain: "auth",
            action: "auth.login.google",
            outcome: "denied",
            message: RATE_LIMITED_MESSAGE,
          });
          return loginRedirect("failed", back, browse);
        }
        const state = newGoogleState();
        const packed = Buffer.from(JSON.stringify({ state, redirect: back ?? "", door, browse })).toString("base64url");
        return new Response(null, {
          status: 302,
          headers: {
            location: googleAuthUrl(state),
            "set-cookie": cookie(packed, MAX_AGE),
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
