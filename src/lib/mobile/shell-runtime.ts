import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { ANDROID_SHELL_KEY, shellKindFromReferrer, shellKindFromUa, type NativeShellKind } from "@/lib/mobile/detect";

type CapacitorWindow = Window & {
  Capacitor?: { getPlatform?: () => string };
};

/**
 * iOS from the user agent. Android only after the TWA referrer was stored for this tab.
 * The server read stays inside the server half so the client bundle never imports it.
 */
export const currentShellKind = createIsomorphicFn()
  .client((): NativeShellKind | null => {
    const platform = (window as CapacitorWindow).Capacitor?.getPlatform?.() ?? null;
    const ios = shellKindFromUa(navigator.userAgent, platform);
    if (ios) return ios;
    try {
      if (sessionStorage.getItem(ANDROID_SHELL_KEY) === "android") return "android";
    } catch {
      /* private mode still has the referrer on the first page */
    }
    return null;
  })
  .server((): NativeShellKind | null => {
    try {
      const request = getRequest();
      return shellKindFromUa(request.headers.get("user-agent") ?? "");
    } catch {
      return null;
    }
  });

export function rememberAndroidShell(): void {
  if (typeof window === "undefined") return;
  if (!shellKindFromReferrer(document.referrer)) return;
  try {
    sessionStorage.setItem(ANDROID_SHELL_KEY, "android");
  } catch {
    /* the first page still knows the referrer */
  }
}
