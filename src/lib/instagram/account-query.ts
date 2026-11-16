/** Bare Instagram account from a handle, an @handle, or a pasted profile URL. */
export function instagramAccountNeedle(raw: string): string | null {
  const cleaned = raw.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  if (cleaned.length < 2 || cleaned.length > 200) return null;
  const fromUrl = cleaned.match(/(?:instagram\.com\/|@)([a-z0-9._]{1,30})/);
  if (fromUrl?.[1]) return fromUrl[1];
  const bare = cleaned.replace(/\/+$/, "");
  if (/^[a-z0-9._]{2,30}$/.test(bare)) return bare;
  return null;
}

/** Search words. An Instagram URL or @handle becomes the account name. */
export function adminSearchTokens(query: string): string[] {
  return query
    .trim()
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => instagramAccountNeedle(token) ?? token);
}
