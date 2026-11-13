const PACKAGE_ID = "by.trenio.app";

/** Colon form, or 64 hex digits. Anything else is dropped. */
export function sha256Fingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const text = part.trim().toUpperCase().replace(/\s+/g, "");
    let colon = "";
    if (/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/.test(text)) colon = text;
    else if (/^[0-9A-F]{64}$/.test(text)) colon = text.replace(/(.{2})(?!$)/g, "$1:");
    if (colon) seen.add(colon);
  }
  return [...seen];
}

export function assetLinks(fingerprints: readonly string[]) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_ID,
        sha256_cert_fingerprints: [...fingerprints],
      },
    },
  ];
}

/** Empty details until APPLE_TEAM_ID is a 10-character team id. */
export function appleAppSiteAssociation(teamId: string | undefined) {
  const id = teamId?.trim().toUpperCase() ?? "";
  const details = /^[A-Z0-9]{10}$/.test(id)
    ? [{ appID: `${id}.${PACKAGE_ID}`, paths: ["*"] }]
    : [];
  return { applinks: { apps: [] as string[], details } };
}
