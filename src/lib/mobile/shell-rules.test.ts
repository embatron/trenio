import assert from "node:assert/strict";
import test from "node:test";

import { decideAppleLink } from "@/lib/auth/auth-decisions";
import { requestCookie } from "@/lib/http/request-cookie";
import { appleClaimsOk } from "@/lib/mobile/apple-claims";
import { parseDeviceRegister, parseDeviceToken } from "@/lib/mobile/device-body";
import { optionalOpenPath, safeOpenPath, shellAppLink } from "@/lib/mobile/paths";
import { isNativeIosShell } from "@/lib/mobile/shell-detect";
import { appleAppSiteAssociation, assetLinks, sha256Fingerprints } from "@/lib/mobile/well-known";
import { isShellRoot, shellBackLabel, shellKindFromReferrer, shellKindFromUa, shellLinkAction } from "@/lib/mobile/detect";

const TOKEN = "a".repeat(64);

test("an open path stays on this site", () => {
  assert.equal(safeOpenPath("/trainers/demo"), "/trainers/demo");
  assert.equal(safeOpenPath("/auth/login?redirect=%2Fmap"), "/auth/login?redirect=%2Fmap");
  assert.equal(safeOpenPath("https://evil.example/trainers/demo"), "/");
  assert.equal(safeOpenPath("//evil.example"), "/");
  assert.equal(safeOpenPath("/\\evil"), "/");
  assert.equal(safeOpenPath("/%2f%2fevil.example"), "/");
  assert.equal(optionalOpenPath(""), null);
  assert.equal(optionalOpenPath("https://evil.example"), null);
  assert.equal(optionalOpenPath("/map"), "/map");
  assert.equal(shellAppLink("https://trenio.by/trainers/demo"), "/trainers/demo");
  assert.equal(shellAppLink("https://www.trenio.by/city/minsk"), "/city/minsk");
  assert.equal(shellAppLink("https://evil.example/trainers/demo"), null);
  assert.equal(shellAppLink("http://trenio.by/map"), null);
});

test("only an APNs token is stored", () => {
  assert.deepEqual(parseDeviceRegister({ token: TOKEN, platform: "ios", tokenType: "apns" }), {
    token: TOKEN,
    platform: "ios",
    tokenType: "apns",
    replacedToken: null,
    deviceName: null,
  });
  assert.equal(parseDeviceRegister({ token: TOKEN, platform: "android", tokenType: "fcm" }), null);
  assert.equal(parseDeviceRegister({ token: "short", platform: "ios", tokenType: "apns" }), null);
  assert.equal(parseDeviceRegister({ token: TOKEN, platform: "ios", tokenType: "apns", replacedToken: "bad" }), null);
  assert.equal(parseDeviceToken({ token: TOKEN }), TOKEN);
  assert.equal(parseDeviceToken({ token: "no" }), null);
});

test("store files keep only real fingerprints and a real team id", () => {
  const hex = "ab".repeat(32);
  const prints = sha256Fingerprints(`${hex}, not-a-print, AA:BB`);
  assert.equal(prints.length, 1);
  assert.equal(prints[0].split(":").length, 32);
  assert.equal(assetLinks(prints)[0].target.package_name, "by.trenio.app");
  assert.equal(appleAppSiteAssociation("abc").applinks.details.length, 0);
  assert.equal(appleAppSiteAssociation("AB12CD34EF").applinks.details[0].appID, "AB12CD34EF.by.trenio.app");
});

test("Apple claims use the bundle id and ignore a foreign token", () => {
  const now = 1_700_000_000;
  assert.equal(appleClaimsOk({
    iss: "https://appleid.apple.com",
    aud: "by.trenio.app",
    exp: now + 60,
    sub: "001234.abcdef",
  }, now, "by.trenio.app"), true);
  assert.equal(appleClaimsOk({
    iss: "https://appleid.apple.com",
    aud: "TEAMID.by.trenio.app",
    exp: now + 60,
    sub: "001234.abcdef",
  }, now, "by.trenio.app"), false);
  assert.equal(appleClaimsOk({
    iss: "https://evil.example",
    aud: "by.trenio.app",
    exp: now + 60,
    sub: "001234.abcdef",
  }, now, "by.trenio.app"), false);
});

test("the website is not the iOS shell", () => {
  assert.equal(isNativeIosShell("Mozilla/5.0"), false);
  assert.equal(isNativeIosShell("Mozilla/5.0 Trenio-iOS/1.0"), true);
  assert.equal(isNativeIosShell("Mozilla/5.0", "ios"), true);
  assert.equal(isNativeIosShell("Mozilla/5.0", "web"), false);
});

test("Apple link follows the mailbox rules", () => {
  assert.equal(decideAppleLink({ exists: false, blocked: false, emailVerified: false, appleSub: null, incomingSub: "a" }), "create");
  assert.equal(decideAppleLink({ exists: true, blocked: false, emailVerified: true, appleSub: null, incomingSub: "a" }), "attach");
  assert.equal(decideAppleLink({ exists: true, blocked: false, emailVerified: true, appleSub: "other", incomingSub: "a" }), "refuse");
  assert.equal(decideAppleLink({ exists: true, blocked: true, emailVerified: true, appleSub: null, incomingSub: "a" }), "refuse");
});

test("a session cookie is read without the neighboring value", () => {
  assert.equal(requestCookie("trenio_session=abc%3D; theme=dark", "trenio_session"), "abc=");
  assert.equal(requestCookie(null, "trenio_session"), null);
  assert.equal(requestCookie("theme=dark", "trenio_session"), null);
});

test("the shell is the iOS agent or the Android app referrer", () => {
  assert.equal(shellKindFromUa("Mozilla/5.0"), null);
  assert.equal(shellKindFromUa("Mozilla/5.0 Trenio-iOS/1.0"), "ios");
  assert.equal(shellKindFromReferrer("android-app://by.trenio.app"), "android");
  assert.equal(shellKindFromReferrer("https://trenio.by/"), null);
  assert.equal(isShellRoot("/account/messages"), true);
  assert.equal(isShellRoot("/trainers/demo"), false);
  assert.equal(shellBackLabel("/trainers/demo", "ios"), "Каталог");
  assert.equal(shellBackLabel("/trainers/demo", "android"), "");
  assert.equal(shellBackLabel("/", "ios"), null);
  assert.equal(shellBackLabel("/account/messages/11111111-1111-1111-1111-111111111111", "ios"), "Сообщения");
  assert.equal(shellBackLabel("/me/messages/11111111-1111-1111-1111-111111111111", "android"), "");
  assert.equal(shellLinkAction({
    href: "/trainers/demo",
    origin: "https://trenio.by",
    target: "_blank",
  })?.kind, "same");
  assert.equal(shellLinkAction({
    href: "https://instagram.com/coach",
    origin: "https://trenio.by",
    target: "_blank",
  })?.kind, "external");
  assert.equal(shellLinkAction({
    href: "tel:+375291112233",
    origin: "https://trenio.by",
    target: "_blank",
  }), null);
  assert.equal(shellLinkAction({
    href: "/map",
    origin: "https://trenio.by",
    target: "",
  }), null);
});
