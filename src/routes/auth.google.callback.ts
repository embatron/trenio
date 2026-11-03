import { createFileRoute } from "@tanstack/react-router";

import { openGoogleAccount } from "@/auth/google-account";
import { googleIdentityFromCode } from "@/auth/google";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { sessionCookieHeader } from "@/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import { claimDoorAfterGoogle } from "@/lib/catalog/trainer-magic";
import { logCaught, writeLog } from "@/lib/log/logger";

const COOKIE = "trenio_google_oauth";

function readPacked(header: string | null): { state: string; redirect: string; door: boolean } | null {
  if (!header) return null;
  const raw = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(decodeURIComponent(raw.slice(COOKIE.length + 1)), "base64url").toString("utf8")) as {
      state?: unknown;
      redirect?: unknown;
      door?: unknown;
    };
    if (typeof parsed.state !== "string" || typeof parsed.redirect !== "string") return null;
    return { state: parsed.state, redirect: parsed.redirect, door: parsed.door === true };
  } catch {
    return null;
  }
}

function cookieValue(header: string | null, name: string): string {
  if (!header) return "";
  const raw = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.slice(name.length + 1));
  } catch {
    return "";
  }
}

function clearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function toLogin(reason: string | null, back: string | null) {
  const params = new URLSearchParams();
  if (reason) params.set("google", reason);
  if (back) params.set("redirect", back);
  const query = params.toString();
  return new Response(null, {
    status: 302,
    headers: {
      location: query ? `/auth/login?${query}` : "/auth/login",
      "set-cookie": clearCookie(),
      "cache-control": "private, no-store",
    },
  });
}

export const Route = createFileRoute("/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const packed = readPacked(request.headers.get("cookie"));
        const back = safeReturnPath(packed?.redirect);
        if (url.searchParams.get("error") === "access_denied") return toLogin(null, back);
        if (!packed || packed.state !== url.searchParams.get("state")) return toLogin("failed", back);
        const code = url.searchParams.get("code")?.trim() ?? "";
        if (!code) return toLogin("failed", back);
        try {
          const identity = await googleIdentityFromCode(code);
          if (!identity) return toLogin("failed", back);
          const result = await openGoogleAccount(identity, back, {
            ipAddress: clientIpFromHeaders(request.headers.get("x-real-ip")),
            userAgent: request.headers.get("user-agent"),
          });
          if (result.kind === "refuse") return toLogin(result.reason === "invalid" ? "failed" : result.reason, back);
          const doorClaim = packed.door
            ? await claimDoorAfterGoogle({
                userId: result.userId,
                email: result.email,
                created: result.kind === "session" && result.created,
                profileId: cookieValue(request.headers.get("cookie"), "trenio_trainer_edit"),
                previewSlug: cookieValue(request.headers.get("cookie"), "trenio_trainer_preview"),
              })
            : null;
          const doorHome = doorClaim === "claimed" || doorClaim === "own" || doorClaim === "busy";
          const created = result.kind === "session" && result.created;
          void writeLog({
            level: "info",
            domain: "auth",
            action: created ? "auth.signup.google" : "auth.login.google",
            outcome: "success",
            message: result.kind === "totp"
              ? "Нужен код приложения."
              : created
                ? "Аккаунт создан через Google."
                : "Вход через Google выполнен.",
            subject: result.email,
            actorUserId: result.userId,
          });
          const headers = new Headers();
          if (result.kind === "totp") {
            const { totpTicketCookieHeader } = await import("@/auth/session");
            headers.append("set-cookie", totpTicketCookieHeader(result.ticket));
            headers.append("set-cookie", clearCookie());
            headers.set("location", "/auth/totp");
          } else {
            headers.append("set-cookie", sessionCookieHeader(result.token));
            headers.append("set-cookie", clearCookie());
            headers.set("location", doorHome ? "/me" : result.redirectTo);
          }
          headers.set("cache-control", "private, no-store");
          return new Response(null, { status: 302, headers });
        } catch (error) {
          logCaught("auth", "auth.login.google", error);
          return toLogin("failed", back);
        }
      },
    },
  },
});
