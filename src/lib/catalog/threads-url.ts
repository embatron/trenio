const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

function usableHandle(handle: string) {
  return HANDLE.test(handle) && /[A-Za-z0-9]/.test(handle);
}

/**
 * A Threads contact stored on the card.
 * An empty value clears it. A profile URL or @handle becomes `https://www.threads.com/@handle`.
 * Anything else is refused.
 */
export function canonicalThreadsUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;
    if (!/^(?:www\.)?threads\.(?:com|net)$/i.test(url.hostname)) return null;
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    const match = /^\/@([A-Za-z0-9._]{1,30})$/.exec(path);
    if (!match || !usableHandle(match[1])) return null;
    return `https://www.threads.com/@${match[1]}`;
  }
  const handle = value.replace(/^@/, "");
  if (!usableHandle(handle)) return null;
  return `https://www.threads.com/@${handle}`;
}

/** `@handle` when the value is a Threads profile. Otherwise the trimmed text. */
export function threadsLabel(raw: string) {
  const url = canonicalThreadsUrl(raw);
  if (!url) return raw.trim();
  return url.slice(url.lastIndexOf("/") + 1);
}
