/**
 * Trusted client IP for rate limits.
 * Nginx should set X-Real-IP to $remote_addr. Do not use X-Forwarded-For[0] —
 * $proxy_add_x_forwarded_for lets the client prepend a fake hop.
 */
export function clientIpFromHeaders(realIp?: string | null): string {
  const trusted = realIp?.trim() ?? "";
  if (!trusted || trusted.length > 64) return "unknown";
  return trusted;
}
