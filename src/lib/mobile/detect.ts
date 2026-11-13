import { isMessageThreadPath, messageListPath } from "@/lib/messages/phone-history";
import { isNativeIosShell } from "@/lib/mobile/shell-detect";

/** Referrer Chrome sends on the first TWA launch. */
export const ANDROID_SHELL_REFERRER = "android-app://by.trenio.app";

/** Kept for the rest of the TWA session. Client navigations replace the referrer. */
export const ANDROID_SHELL_KEY = "trenio-native";

export type NativeShellKind = "ios" | "android";

export function shellKindFromUa(userAgent: string, platform?: string | null): NativeShellKind | null {
  return isNativeIosShell(userAgent, platform) ? "ios" : null;
}

export function shellKindFromReferrer(referrer: string | null | undefined): NativeShellKind | null {
  if (!referrer?.startsWith(ANDROID_SHELL_REFERRER)) return null;
  return "android";
}

export function shellClassName(kind: NativeShellKind | null): string {
  if (kind === "ios") return "app-native app-native-ios";
  if (kind === "android") return "app-native app-native-android";
  return "";
}

/** Tab roots. A back control would duplicate the tab the person just pressed. */
export function isShellRoot(pathname: string): boolean {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return path === "/"
    || path === "/account"
    || path === "/account/favorites"
    || path === "/account/messages"
    || path === "/me"
    || path === "/me/profile"
    || path === "/me/messages"
    || path === "/me/stats"
    || path === "/admin"
    || path === "/admin/messages";
}

/** Open dialog on a phone. The shell back control returns to that dialog list. */
export function shellThreadList(pathname: string): "/account/messages" | "/me/messages" | null {
  if (!isMessageThreadPath(pathname)) return null;
  return messageListPath(pathname);
}

/** Null hides the control. An empty string is the Android arrow without a title. */
export function shellBackLabel(pathname: string, kind: NativeShellKind): string | null {
  const path = pathname.split("?")[0];
  if (shellThreadList(path)) return kind === "android" ? "" : "Сообщения";
  if (path.startsWith("/auth") || isShellRoot(path)) return null;
  if (kind === "android") return "";
  if (path.startsWith("/trainers")) return "Каталог";
  if (path.startsWith("/city") || path.startsWith("/categories") || path.startsWith("/map")) return "Поиск";
  if (path.startsWith("/account") || path.startsWith("/me") || path.startsWith("/admin")) return "Кабинет";
  return "Назад";
}

export type ShellLinkAction =
  | { kind: "same"; path: string }
  | { kind: "external"; href: string };

/**
 * A new-tab link inside the shell.
 * Same-site links stay in the stack. Everything else is the system browser.
 * A normal click, a phone number, and a mail link keep the browser default.
 */
export function shellLinkAction(input: {
  href: string;
  origin: string;
  target: string;
}): ShellLinkAction | null {
  if (input.target !== "_blank") return null;
  let url: URL;
  try {
    url = new URL(input.href, input.origin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const hosts = new Set(["trenio.by", "www.trenio.by"]);
  try {
    hosts.add(new URL(input.origin).hostname);
  } catch {
    /* the page origin is already the fallback of URL */
  }
  if (hosts.has(url.hostname)) {
    return { kind: "same", path: `${url.pathname}${url.search}${url.hash}` };
  }
  return { kind: "external", href: url.href };
}
