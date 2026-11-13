const IOS_TOKEN = /Trenio-iOS\/\d/;

/** True for the Capacitor iOS shell. The site and the Android TWA stay false. */
export function isNativeIosShell(userAgent: string, platform?: string | null): boolean {
  if (platform === "ios") return true;
  return IOS_TOKEN.test(userAgent);
}
