/** A same-site path for /open and for the return address after Apple sign-in. */
export function safeOpenPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const text = value.trim();
  if (text.length === 0 || text.length > 512) return "/";
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\") || text.includes("://")) return "/";
  try {
    const url = new URL(text, "https://trenio.by");
    if (url.origin !== "https://trenio.by") return "/";
    const path = `${url.pathname}${url.search}${url.hash}`;
    let decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return "/";
    }
    if (!path.startsWith("/") || path.startsWith("//") || decoded.startsWith("//")) return "/";
    if (path.includes("\\") || path.includes("://") || decoded.includes("\\") || decoded.includes("://")) return "/";
    return path;
  } catch {
    return "/";
  }
}

/** Null when the caller did not ask for a path, or asked for another site. */
export function optionalOpenPath(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const safe = safeOpenPath(value);
  if (safe === "/" && value.trim() !== "/") return null;
  return safe;
}

/** A Universal Link or App Link that may open inside the shell. */
export function shellAppLink(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "trenio.by" && url.hostname !== "www.trenio.by") return null;
  return optionalOpenPath(`${url.pathname}${url.search}${url.hash}`);
}
