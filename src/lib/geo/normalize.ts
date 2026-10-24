/** Trim and collapse whitespace. Queries shorter than 3 characters are rejected. */
export function sanitizeQuery(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed.length < 3 || collapsed.length > 200) return null;
  return collapsed;
}

/**
 * Cache key: lower case, punctuation removed, spaces collapsed.
 * Returns null when the sanitized query is empty or shorter than 3 characters.
 */
export function normalizeQuery(raw: string): string | null {
  const sanitized = sanitizeQuery(raw);
  if (!sanitized) return null;
  const stripped = sanitized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 3) return null;
  return stripped;
}
