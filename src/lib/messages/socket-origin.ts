/** True when the browser page that opened the socket is this site. */
export function socketOriginAllowed(origin: string | null, allowedHosts: readonly string[]): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return allowedHosts.includes(url.host);
  } catch {
    return false;
  }
}
