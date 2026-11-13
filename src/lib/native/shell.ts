import { isNativeIosShell } from "@/lib/mobile/shell-detect";
import { shellAppLink } from "@/lib/mobile/paths";

const PUSH_KEY = "trenio-apns-token";

type CapacitorWindow = Window & {
  Capacitor?: { getPlatform?: () => string };
};

export function nativeIosShell(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (window as CapacitorWindow).Capacitor?.getPlatform?.() ?? null;
  return isNativeIosShell(navigator.userAgent, platform);
}

/** Google and Yandex open in the system browser inside the iOS shell. */
export function openProviderInShell(event: { preventDefault(): void }, path: string): void {
  if (!nativeIosShell()) return;
  event.preventDefault();
  const url = new URL(path, window.location.origin).href;
  void import("@capacitor/browser")
    .then(({ Browser }) => Browser.open({ url }))
    .catch(() => {
      window.location.assign(path);
    });
}

export async function signInWithApple(input: {
  returnPath?: string;
  browse?: boolean;
}): Promise<{ redirectTo: string } | { error: string }> {
  const plugin = await import("@capacitor-community/apple-sign-in");
  const result = await plugin.SignInWithApple.authorize({
    clientId: "by.trenio.app",
    redirectURI: `${window.location.origin}/auth/login`,
    scopes: "email name",
  });
  const response = result.response;
  const identityToken = response.identityToken ?? "";
  if (!identityToken) return { error: "Не удалось войти через Apple. Попробуйте ещё раз." };
  const saved = await fetch("/api/auth/apple", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identityToken,
      returnPath: input.returnPath,
      browse: input.browse === true,
      user: {
        email: response.email,
        firstName: response.givenName,
        lastName: response.familyName,
      },
    }),
  });
  const payload = (await saved.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
  if (!saved.ok || !payload?.redirectTo) {
    return { error: "Не удалось войти через Apple. Попробуйте ещё раз." };
  }
  return { redirectTo: payload.redirectTo };
}

/** Asks for the camera once, then the existing file field still accepts a PDF. */
export async function prepareShellCamera(): Promise<void> {
  if (!nativeIosShell()) return;
  try {
    const { Camera } = await import("@capacitor/camera");
    await Camera.requestPermissions({ permissions: ["camera", "photos"] });
  } catch {
    /* the system file picker still opens */
  }
}

export async function shellCoordinates(): Promise<{ lat: number; lng: number } | "skip" | "denied"> {
  if (!nativeIosShell()) return "skip";
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    const granted = perm.location === "granted" || perm.coarseLocation === "granted";
    if (!granted) return "denied";
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return "denied";
  }
}

async function rememberPushToken(token: string): Promise<void> {
  const previous = localStorage.getItem(PUSH_KEY);
  await fetch("/api/push/register", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      platform: "ios",
      tokenType: "apns",
      replacedToken: previous && previous !== token ? previous : undefined,
    }),
  });
  localStorage.setItem(PUSH_KEY, token);
}

async function listenForAppLinks(): Promise<void> {
  const { App } = await import("@capacitor/app");
  await App.addListener("appUrlOpen", (event) => {
    const next = shellAppLink(event.url);
    if (next) window.location.assign(next);
  });
}

/** Status bar, splash, keyboard, and APNs. No-op in a browser. */
export async function bootNativeShell(userId: string | null): Promise<void> {
  if (!nativeIosShell()) return;
  try {
    await listenForAppLinks();
  } catch {
    /* a link can still be opened from the site itself */
  }
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { Keyboard, KeyboardResize }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
      import("@capacitor/keyboard"),
    ]);
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#f04b50" });
    await SplashScreen.hide();
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    /* the page still works if a plugin is missing */
  }
  if (!userId) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.addListener("registration", (event) => {
      void rememberPushToken(event.value);
    });
    await PushNotifications.register();
  } catch {
    /* a missing APNs entitlement leaves the web session intact */
  }
}

/** Drops this phone's token before the session cookie is cleared. */
export async function releaseShellPush(): Promise<void> {
  if (!nativeIosShell()) return;
  const token = localStorage.getItem(PUSH_KEY);
  if (!token) return;
  try {
    await fetch("/api/device/unregister", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* logout continues */
  }
  localStorage.removeItem(PUSH_KEY);
}

export function logoutWithShell(logout: () => Promise<unknown>): Promise<unknown> {
  return releaseShellPush().then(() => logout());
}
