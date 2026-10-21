/** Same-site path safe to use after login. Rejects protocol-relative and external URLs. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 2 || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://") || value.includes("\0")) return null;
  return value;
}
