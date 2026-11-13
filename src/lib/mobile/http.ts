import { getSessionUserFromToken } from "@/auth/service";
import { sessionCookieHeader, totpTicketCookieHeader } from "@/auth/session";
import { consumeRateLimit, RATE_LIMITS } from "@/auth/rate-limit";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { openAppleAccount } from "@/auth/apple-account";
import { requestCookie } from "@/lib/http/request-cookie";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { writeLog } from "@/lib/log/logger";
import { ensurePushSchema } from "@/lib/messages/push-schema";
import { parseDeviceRegister, parseDeviceToken } from "@/lib/mobile/device-body";
import { listDevices, removeDevice, saveDevice } from "@/lib/mobile/devices";
import { optionalOpenPath } from "@/lib/mobile/paths";
import { appleAppSiteAssociation, assetLinks, sha256Fingerprints } from "@/lib/mobile/well-known";

const SESSION_COOKIE = "trenio_session";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function clientMeta(request: Request) {
  return {
    ipAddress: clientIpFromHeaders(request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent"),
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function appleAudience(): string {
  return process.env.APPLE_CLIENT_ID?.trim() || "";
}

async function sessionUser(request: Request) {
  const token = requestCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return null;
  return getSessionUserFromToken(token);
}

/** Mobile shell endpoints. Null lets the rest of the site handle the request. */
export async function handleMobileApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/.well-known/assetlinks.json") {
    return json(assetLinks(sha256Fingerprints(process.env.ANDROID_SHA256_FINGERPRINTS)));
  }
  if (request.method === "GET" && url.pathname === "/.well-known/apple-app-site-association") {
    return json(appleAppSiteAssociation(process.env.APPLE_TEAM_ID));
  }
  if (request.method === "POST" && url.pathname === "/api/auth/apple") return appleLogin(request);
  if (request.method === "POST" && url.pathname === "/api/push/register") return registerPush(request);
  if (request.method === "POST" && url.pathname === "/api/device/unregister") return unregisterPush(request);
  if (request.method === "GET" && url.pathname === "/api/device/info") return deviceInfo(request);
  return null;
}

async function appleLogin(request: Request): Promise<Response> {
  const audience = appleAudience();
  if (!audience) return new Response(null, { status: 404 });
  const meta = clientMeta(request);
  const limit = await consumeRateLimit(`apple:${meta.ipAddress || "unknown"}`, RATE_LIMITS.loginIp.windowMs, RATE_LIMITS.loginIp.max);
  if (!limit.ok) {
    void writeLog({
      level: "warn",
      domain: "auth",
      action: "auth.login.apple",
      outcome: "denied",
      message: "Слишком много входов через Apple.",
    });
    return json({ error: "Слишком много попыток. Подождите и попробуйте снова." }, 429);
  }
  const body = await readJson(request);
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const identityToken = typeof record.identityToken === "string" ? record.identityToken : "";
  const user = record.user && typeof record.user === "object" ? record.user as Record<string, unknown> : {};
  const firstName = typeof user.firstName === "string" ? user.firstName.trim().slice(0, 100) : "";
  const lastName = typeof user.lastName === "string" ? user.lastName.trim().slice(0, 100) : "";
  const { verifyAppleIdentity } = await import("@/lib/mobile/apple-token");
  const identity = await verifyAppleIdentity(identityToken, audience);
  if (!identity) {
    void writeLog({
      level: "warn",
      domain: "auth",
      action: "auth.login.apple",
      outcome: "failure",
      message: "Apple не подтвердил вход.",
    });
    return json({ error: "Не удалось войти через Apple. Попробуйте ещё раз." }, 401);
  }
  try {
    const opened = await openAppleAccount(
      identity,
      { firstName, lastName },
      typeof record.returnPath === "string" ? optionalOpenPath(record.returnPath) : null,
      meta,
      record.browse === true,
    );
    if (opened.kind === "refuse") {
      void writeLog({
        level: "warn",
        domain: "auth",
        action: "auth.login.apple",
        outcome: "denied",
        message: "Вход через Apple отклонён.",
        context: { reason: opened.reason },
      });
      return json({ error: opened.reason }, 403);
    }
    const subject = isPendingSignupEmail(opened.email) ? null : opened.email;
    void writeLog({
      level: "info",
      domain: "auth",
      action: "auth.login.apple",
      outcome: "success",
      message: opened.kind === "totp" ? "Apple попросил код сотрудника." : "Вход через Apple.",
      subject,
      actorUserId: opened.userId,
      context: { created: opened.kind === "session" ? opened.created : false },
    });
    if (opened.kind === "totp") {
      return json({ redirectTo: "/auth/totp" }, 200, { "set-cookie": totpTicketCookieHeader(opened.ticket) });
    }
    return json({ redirectTo: opened.redirectTo }, 200, { "set-cookie": sessionCookieHeader(opened.token) });
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "auth",
      action: "auth.login.apple",
      outcome: "failure",
      message: "Вход через Apple не завершился.",
      error,
    });
    return json({ error: "Не удалось войти через Apple. Попробуйте ещё раз." }, 500);
  }
}

async function registerPush(request: Request): Promise<Response> {
  const user = await sessionUser(request);
  if (!user) return json({ error: "Нужен вход." }, 401);
  const device = parseDeviceRegister(await readJson(request));
  if (!device) return json({ error: "Некорректный токен." }, 400);
  const limit = await consumeRateLimit(`push:${user.id}`, 15 * 60_000, 30);
  if (!limit.ok) return json({ error: "Слишком много попыток. Подождите и попробуйте снова." }, 429);
  try {
    await ensurePushSchema();
    await saveDevice(user.id, device);
    void writeLog({
      level: "info",
      domain: "auth",
      action: "auth.device",
      outcome: "success",
      message: "Телефон подписан на уведомления.",
      subject: isPendingSignupEmail(user.email) ? null : user.email,
      actorUserId: user.id,
      context: { platform: device.platform, tokenType: device.tokenType },
    });
    return json({ ok: true });
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "auth",
      action: "auth.device",
      outcome: "failure",
      message: "Телефон не подписался на уведомления.",
      actorUserId: user.id,
      error,
    });
    return json({ error: "Не удалось сохранить устройство." }, 500);
  }
}

async function unregisterPush(request: Request): Promise<Response> {
  const user = await sessionUser(request);
  if (!user) return json({ error: "Нужен вход." }, 401);
  const token = parseDeviceToken(await readJson(request));
  if (!token) return json({ error: "Некорректный токен." }, 400);
  try {
    await ensurePushSchema();
    await removeDevice(user.id, token);
    void writeLog({
      level: "info",
      domain: "auth",
      action: "auth.device",
      outcome: "success",
      message: "Телефон отписан от уведомлений.",
      actorUserId: user.id,
      context: { removed: true },
    });
    return json({ ok: true });
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "auth",
      action: "auth.device",
      outcome: "failure",
      message: "Телефон не отписался от уведомлений.",
      actorUserId: user.id,
      error,
    });
    return json({ error: "Не удалось снять устройство." }, 500);
  }
}

async function deviceInfo(request: Request): Promise<Response> {
  const user = await sessionUser(request);
  if (!user) return json({ error: "Нужен вход." }, 401);
  try {
    await ensurePushSchema();
    const devices = await listDevices(user.id);
    return json({ devices });
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "auth",
      action: "auth.device",
      outcome: "failure",
      message: "Список устройств не открылся.",
      actorUserId: user.id,
      error,
    });
    return json({ error: "Не удалось прочитать устройства." }, 500);
  }
}
