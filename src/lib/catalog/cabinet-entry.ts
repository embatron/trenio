import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { AuthError } from "@/lib/auth/errors";
import { cabinetEntryAdmit } from "@/lib/catalog/cabinet-entry-admit";
import { doorSchema, limitDeniedEntry, lookEntry, noteEntry } from "@/lib/catalog/cabinet-entry-work";
import { writeLog } from "@/lib/log/logger";

export const peekCabinetEntryFn = createServerFn({ method: "GET" })
  .validator(doorSchema)
  .handler(async ({ data }) => {
    const look = await lookEntry(data.code, data.token);
    if (look.state !== "live") {
      await limitDeniedEntry(clientIpFromHeaders(getRequest().headers.get("x-real-ip")));
      noteEntry(look.state, look.slug, look.email);
      return null;
    }
    noteEntry("live", look.slug, look.email);
    return { ok: true as const, slug: look.slug };
  });

export const openCabinetEntryFn = createServerFn({ method: "POST" })
  .validator(doorSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const look = await lookEntry(data.code, data.token);
    if (look.state !== "live" || !look.userId || !look.slug) {
      await limitDeniedEntry(clientIpFromHeaders(getRequest().headers.get("x-real-ip")));
      noteEntry(look.state, look.slug, look.email);
      throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");
    }
    const preview = cabinetEntryAdmit({
      userAgent: request.headers.get("user-agent") ?? "",
      ip: clientIpFromHeaders(request.headers.get("x-real-ip")),
      purpose: [request.headers.get("purpose"), request.headers.get("sec-purpose"), request.headers.get("x-purpose")].filter(Boolean).join(" "),
      fetchDest: request.headers.get("sec-fetch-dest") ?? "",
      fetchMode: request.headers.get("sec-fetch-mode") ?? "",
    }) === "preview";
    if (preview) {
      noteEntry("live", look.slug, look.email);
      throw new AuthError("Ссылка уже не действует.", "INVALID_TOKEN");
    }
    const { openDoorSession } = await import("@/lib/catalog/trainer-door-session");
    const next = await openDoorSession(look.userId);
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.entry",
      outcome: "success",
      message: "Одноразовая ссылка открыла кабинет.",
      subject: look.email,
      actorUserId: look.userId,
      target: look.slug,
    });
    const redirectTo = next === "/auth/totp" ? next : "/me";
    return { ok: true as const, slug: look.slug, needsPassword: look.needsPassword, redirectTo };
  });
