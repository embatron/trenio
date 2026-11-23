export const CABINET_ENTRY_MS = 7 * 24 * 60 * 60 * 1000;
/** A newer link sets useCount to this. Opening the current link does not. */
export const CABINET_ENTRY_OPENS = 3;

export type ConfirmedMailbox = {
  profileId: string;
  userId: string;
  slug: string;
  email: string;
  name: string;
  previewToken: string;
  status: string;
  needsPassword: boolean;
  created: boolean;
  attached: boolean;
};

export type CabinetEntryState = "live" | "used" | "expired" | "closed" | "mismatch";

/** A cabinet link the person already used. It stays closed for a later visit and for a hidden client. */
export const CLOSED_DESK_SLUGS = ["elsakov_ivan"] as const;

export function deskStayClosed(slug: string | null, state: CabinetEntryState): CabinetEntryState {
  if (slug != null && (CLOSED_DESK_SLUGS as readonly string[]).includes(slug)) return "used";
  return state;
}

/** The link opens one owner of one card until it expires or a newer link replaces it. */
export function cabinetEntryState(input: {
  useCount: number;
  expiresAt: Date;
  now: Date;
  userStatus: string;
  ownerUserId: string | null;
  entryUserId: string;
  profileId: string;
  entryProfileId: string;
}): CabinetEntryState {
  if (input.useCount >= CABINET_ENTRY_OPENS) return "used";
  if (input.expiresAt.getTime() <= input.now.getTime()) return "expired";
  if (input.userStatus === "deleted" || input.userStatus === "suspended") return "closed";
  if (input.ownerUserId !== input.entryUserId || input.profileId !== input.entryProfileId) return "mismatch";
  return "live";
}
