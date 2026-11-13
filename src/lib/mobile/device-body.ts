export type DeviceRegister = {
  token: string;
  platform: "ios";
  tokenType: "apns";
  replacedToken: string | null;
  deviceName: string | null;
};

const TOKEN = /^[A-Za-z0-9_-]{32,512}$/;

function cleanToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return TOKEN.test(text) ? text : null;
}

/** Accepts one APNs device token. Anything else is refused. */
export function parseDeviceRegister(value: unknown): DeviceRegister | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.platform !== "ios" || body.tokenType !== "apns") return null;
  const token = cleanToken(body.token);
  if (!token) return null;
  const replaced = body.replacedToken == null || body.replacedToken === "" ? null : cleanToken(body.replacedToken);
  if (body.replacedToken != null && body.replacedToken !== "" && !replaced) return null;
  const name = typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 80) : "";
  return {
    token,
    platform: "ios",
    tokenType: "apns",
    replacedToken: replaced,
    deviceName: name || null,
  };
}

export function parseDeviceToken(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return cleanToken((value as { token?: unknown }).token);
}
