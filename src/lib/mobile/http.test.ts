import assert from "node:assert/strict";
import test from "node:test";

import { handleMobileApi } from "@/lib/mobile/http";

function call(path: string, method = "GET", body?: unknown) {
  return handleMobileApi(new Request(`https://trenio.by${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }));
}

test("store association files are JSON and Apple login stays hidden without a client id", async () => {
  const previous = process.env.APPLE_CLIENT_ID;
  const team = process.env.APPLE_TEAM_ID;
  const prints = process.env.ANDROID_SHA256_FINGERPRINTS;
  delete process.env.APPLE_CLIENT_ID;
  process.env.APPLE_TEAM_ID = "nope";
  process.env.ANDROID_SHA256_FINGERPRINTS = "zzzz";
  try {
    const links = await call("/.well-known/assetlinks.json");
    assert.ok(links);
    assert.equal(links.headers.get("content-type"), "application/json; charset=utf-8");
    const linkBody = await links.json() as Array<{ target: { package_name: string; sha256_cert_fingerprints: string[] } }>;
    assert.equal(linkBody[0].target.package_name, "by.trenio.app");
    assert.deepEqual(linkBody[0].target.sha256_cert_fingerprints, []);

    const apple = await call("/.well-known/apple-app-site-association");
    assert.ok(apple);
    const association = await apple.json() as { applinks: { details: unknown[] } };
    assert.deepEqual(association.applinks.details, []);

    const hidden = await call("/api/auth/apple", "POST", { identityToken: "x" });
    assert.equal(hidden?.status, 404);

    const devices = await call("/api/device/info");
    assert.equal(devices?.status, 401);
    const register = await call("/api/push/register", "POST", { token: "a".repeat(64), platform: "ios", tokenType: "apns" });
    assert.equal(register?.status, 401);
  } finally {
    if (previous === undefined) delete process.env.APPLE_CLIENT_ID;
    else process.env.APPLE_CLIENT_ID = previous;
    if (team === undefined) delete process.env.APPLE_TEAM_ID;
    else process.env.APPLE_TEAM_ID = team;
    if (prints === undefined) delete process.env.ANDROID_SHA256_FINGERPRINTS;
    else process.env.ANDROID_SHA256_FINGERPRINTS = prints;
  }
});
