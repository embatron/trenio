import { SMS_BY_CANONICAL_ALPHANAME_ID } from "./alphaname";

export function isSmsByEnabled(): boolean {
  return process.env.SMS_BY_ENABLED === "true" && Boolean(process.env.SMS_BY_API_KEY?.trim());
}

export function smsByApiKey(): string {
  return process.env.SMS_BY_API_KEY?.trim() ?? "";
}

/** Numeric SMS.BY alphaname id. Empty env falls back to TRENIO.BY. */
export function smsByAlphanameId(): string {
  return process.env.SMS_BY_ALPHANAME_ID?.trim() || SMS_BY_CANONICAL_ALPHANAME_ID;
}
