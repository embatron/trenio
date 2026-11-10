/**
 * Local public name. `/etc/hosts` maps it to 127.0.0.9.
 * Apache listens on 80 and 8080 and proxies this name to Vite on 8081.
 */
export const LOCAL_APP_ORIGIN = "http://trenio.local";

/** `APP_URL` when set, otherwise the local public name. Never port 8080. */
export function appOrigin(): string {
  return (process.env.APP_URL ?? LOCAL_APP_ORIGIN).replace(/\/$/, "");
}
