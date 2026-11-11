import { normalizeBelarusMobile } from "@/lib/auth/phone";

export type WelcomeStaffStatus = "new" | "done" | "rejected";

/** One `/join/trainer` application. The id stays on each database and is not the sync key. */
export type WelcomeSync = {
  channel: "instagram" | "other";
  instagram: string;
  telegram: string;
  phone: string;
  createdAt: string;
  linkSentAt: string | null;
  staffStatus: WelcomeStaffStatus;
};

export type WelcomeUpdate = {
  linkSentAt?: string;
  staffStatus?: WelcomeStaffStatus;
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function moment(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function staffStatus(value: unknown): WelcomeStaffStatus {
  return value === "done" || value === "rejected" ? value : "new";
}

/** A site row the laptop can store. A broken timestamp is dropped. */
export function readWelcomeSync(value: unknown): WelcomeSync | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const createdAt = moment(row.createdAt);
  if (!createdAt) return null;
  const channel =
    row.channel === "other" ? "other" : row.channel === "instagram" ? "instagram" : null;
  if (!channel) return null;
  return {
    channel,
    instagram: text(row.instagram, 30),
    telegram: text(row.telegram, 32),
    phone: text(row.phone, 20),
    createdAt,
    linkSentAt: moment(row.linkSentAt),
    staffStatus: staffStatus(row.staffStatus),
  };
}

function phoneKey(value: string) {
  return normalizeBelarusMobile(value) ?? value.trim().toLowerCase();
}

/** Same application on both sides: channel, contacts, and the second it was submitted. */
export function welcomeIdentity(
  row: Pick<WelcomeSync, "channel" | "instagram" | "telegram" | "phone" | "createdAt">,
) {
  const created = new Date(row.createdAt);
  const stamp = Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0, 19);
  return [
    row.channel,
    row.instagram.trim().toLowerCase(),
    row.telegram.trim().toLowerCase(),
    phoneKey(row.phone),
    stamp,
  ].join("\n");
}

/**
 * The site is the source of a new application.
 * A done or rejected decision moves down. A local decision stays while the site is still new.
 * A visit time fills an empty laptop mark and does not clear one the laptop already has.
 */
export function welcomeUpdate(
  local: Pick<WelcomeSync, "linkSentAt" | "staffStatus">,
  incoming: WelcomeSync,
): WelcomeUpdate | null {
  const patch: WelcomeUpdate = {};
  if (!local.linkSentAt && incoming.linkSentAt) patch.linkSentAt = incoming.linkSentAt;
  if (
    (incoming.staffStatus === "done" || incoming.staffStatus === "rejected") &&
    local.staffStatus !== incoming.staffStatus
  ) {
    patch.staffStatus = incoming.staffStatus;
  }
  return patch.linkSentAt || patch.staffStatus ? patch : null;
}
