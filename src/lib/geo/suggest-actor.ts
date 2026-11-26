import { clientIpFromHeaders } from "@/auth/request-meta";

/** A signed-in person is counted by account. A guest on the public form is counted by the trusted client IP. */
export function suggestActorKey(userId: string | null | undefined, realIp: string | null | undefined): string {
  const id = userId?.trim() ?? "";
  if (id) return `user:${id}`;
  return `ip:${clientIpFromHeaders(realIp)}`;
}
