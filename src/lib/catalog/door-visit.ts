/**
 * A «Заход» is a person opening `/hi/{code}`.
 * Instagram fetches the address while the letter is still in the composer, so a
 * preview robot must not set the column.
 */

const PREVIEW_UA = [
  /facebookexternalhit/i,
  /Facebot/i,
  /meta-externalagent/i,
  /facebookcatalog/i,
  /Twitterbot/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /LinkedInBot/i,
  /Pinterestbot/i,
  /Googlebot/i,
  /bingbot/i,
  /Applebot/i,
  /Embedly/i,
  /Iframely/i,
  /vkShare/i,
  /redditbot/i,
  /Android 10; K\)/,
  /Chrome\/74\.0\.3729\.131/,
  /Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/139\.0\.0\.0 Safari\/537\.36/,
];

/** Networks that fetch link previews for Meta. A phone on these addresses is not a trainer. */
const META_CRAWLER_NETS: Array<[string, number]> = [
  ["173.252.64.0", 18],
  ["69.63.176.0", 20],
  ["66.220.144.0", 20],
  ["157.240.0.0", 16],
  ["31.13.0.0", 16],
  ["129.134.0.0", 16],
  ["57.141.0.0", 16],
];

export type DoorHit = {
  at: Date;
  userAgent: string;
  ip: string;
};

function ipv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const addr = ipv4(ip);
  const network = ipv4(base);
  if (addr == null || network == null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (addr & mask) === (network & mask);
}

export function isMetaCrawlerIp(ip: string): boolean {
  return META_CRAWLER_NETS.some(([base, bits]) => inCidr(ip, base, bits));
}

/** True when this request is a link preview or another robot, not a person. */
export function isLinkPreviewVisit(userAgent: string, ip = ""): boolean {
  if (PREVIEW_UA.some((pattern) => pattern.test(userAgent))) return true;
  return isMetaCrawlerIp(ip);
}

/** Earliest open that was not a preview robot. Null when every hit is a robot. */
export function earliestHumanVisit(hits: DoorHit[]): Date | null {
  let earliest: Date | null = null;
  for (const hit of hits) {
    if (isLinkPreviewVisit(hit.userAgent, hit.ip)) continue;
    if (!earliest || hit.at.getTime() < earliest.getTime()) earliest = hit.at;
  }
  return earliest;
}
