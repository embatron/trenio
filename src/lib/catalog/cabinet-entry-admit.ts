/**
 * Instagram's preview fetches the link before the person taps it.
 * That fetch must not receive a session. A person, including the Instagram app, does.
 */

const PREVIEW_UA =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|Discordbot|LinkedInBot|Googlebot|bingbot|YandexBot|Applebot|vkShare|Pinterestbot|redditbot|Embedly|ia_archiver|curl\/|python-requests|Go-http-client|wget\/|HeadlessChrome/i;

/** Networks that sent the preview browser. A person's Instagram app is never one of these. */
const PREVIEW_NETS: Array<[string, number]> = [
  ["173.252.64.0", 18],
  ["66.220.144.0", 20],
  ["69.63.176.0", 20],
  ["69.171.224.0", 19],
  ["157.240.0.0", 16],
  ["31.13.24.0", 21],
  ["31.13.64.0", 18],
  ["129.134.0.0", 16],
  ["102.132.96.0", 20],
  ["185.60.216.0", 22],
  ["204.15.20.0", 22],
  ["57.141.0.0", 16],
];

export type CabinetEntryAdmit = "open" | "preview";

function ipv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
}

function inPreviewNet(ip: string): boolean {
  const value = ipv4(ip);
  if (value == null) return false;
  return PREVIEW_NETS.some(([base, bits]) => {
    const network = ipv4(base);
    if (network == null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (network & mask);
  });
}

/** Whether this request may receive the cabinet session. */
export function cabinetEntryAdmit(input: {
  userAgent: string;
  ip: string;
  purpose: string;
  fetchDest: string;
  fetchMode: string;
}): CabinetEntryAdmit {
  const purpose = input.purpose.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("preview")) return "preview";
  const dest = input.fetchDest.toLowerCase();
  if (dest && dest !== "document") return "preview";
  const mode = input.fetchMode.toLowerCase();
  if (mode && mode !== "navigate") return "preview";
  const ua = input.userAgent.trim();
  if (!ua) return "preview";
  if (/Instagram/i.test(ua)) return "open";
  if (PREVIEW_UA.test(ua)) return "preview";
  if (/Android 10; K\)/.test(ua)) return "preview";
  if (inPreviewNet(input.ip)) return "preview";
  return "open";
}
