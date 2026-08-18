export function isSmsByEnabled(): boolean {
  return process.env.SMS_BY_ENABLED === "true" && Boolean(process.env.SMS_BY_API_KEY?.trim());
}

export function smsByApiKey(): string {
  return process.env.SMS_BY_API_KEY?.trim() ?? "";
}

export function smsByAlphanameId(): string {
  return process.env.SMS_BY_ALPHANAME_ID?.trim() ?? "";
}
