import assert from "node:assert/strict";
import test from "node:test";

import { acceptClientEvent, clientLogEventSchema } from "@/lib/log/client-schema";
import { fileHasLoggingGap, isLoggingGapPath } from "@/lib/log/gaps";
import { LOG_RETENTION_DAYS, logExpiresAt, passesLevel } from "@/lib/log/policy";
import { maskPhone, normalizeSubject, redactContext, safeRoute } from "@/lib/log/redact";

test("journal retention is 30 days", () => {
  assert.equal(LOG_RETENTION_DAYS, 30);
  const from = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(logExpiresAt(from).toISOString(), "2026-01-31T00:00:00.000Z");
});

test("info threshold keeps warnings and drops debug", () => {
  assert.equal(passesLevel("debug", "info"), false);
  assert.equal(passesLevel("info", "info"), true);
  assert.equal(passesLevel("error", "info"), true);
});

test("redact strips secrets and keeps the email", () => {
  const clean = redactContext({
    password: "Admin1234",
    token: "reset-token",
    code: "123456",
    body: "<p>hello</p>",
    email: "client@trenio.by",
    slug: "coach",
  }) as Record<string, unknown>;
  assert.equal(clean.password, "[redacted]");
  assert.equal(clean.token, "[redacted]");
  assert.equal(clean.code, "[redacted]");
  assert.equal(clean.body, "[redacted]");
  assert.equal(clean.email, "client@trenio.by");
  assert.equal(clean.slug, "coach");
});

test("subject and route drop tokens", () => {
  assert.equal(normalizeSubject("  Client@Trenio.by "), "client@trenio.by");
  assert.equal(normalizeSubject("bearer abc"), null);
  assert.equal(maskPhone("+375 33 637-62-68"), "375*******68");
  assert.equal(safeRoute("/auth/reset-password?token=abc"), "/auth/reset-password");
});

test("client events cannot carry a password", () => {
  const parsed = clientLogEventSchema.parse({
    domain: "client",
    level: "error",
    action: "client.error",
    message: "password=secret",
    route: "/auth/login",
  });
  assert.equal(acceptClientEvent(parsed), false);
});

test("a console.error without the logger is a gap", () => {
  assert.equal(fileHasLoggingGap('console.error("boom")'), true);
  assert.equal(fileHasLoggingGap('import { writeLog } from "@/lib/log/logger";\nconsole.error("boom")'), false);
  assert.equal(isLoggingGapPath("src/db/seed.ts"), false);
  assert.equal(isLoggingGapPath("src/lib/auth/functions.ts"), true);
});
