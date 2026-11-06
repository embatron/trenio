/**
 * Nominatim does not read a Belarus avenue abbreviation.
 * «пр.Дзержинского», «пр-т» and «просп.» become «проспект» in the lookup only.
 * The stored street stays as printed.
 */
export function expandStreetQuery(raw: string): string {
  return raw
    .replace(/(?<![\p{L}])пр-т\.?(?![\p{L}])/giu, "проспект")
    .replace(/(?<![\p{L}])просп\.(?![\p{L}])/giu, "проспект")
    .replace(/(?<![\p{L}])пр\.\s*/giu, "проспект ");
}

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
