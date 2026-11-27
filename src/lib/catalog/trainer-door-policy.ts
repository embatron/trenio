export function trainerDoorClaimable(input: {
  ownerUserId: string | null;
  status: string;
}): boolean {
  return input.ownerUserId == null && (input.status === "draft" || input.status === "published");
}

/**
 * The confirm controls belong to the short link.
 * A catalog visit passes `doorCode` and stays closed unless that code is this card's link.
 * The revise page omits `doorCode` and keeps the cookie session.
 */
export function trainerMagicDoorOpen(input: {
  previewCookie: string | null | undefined;
  slug: string;
  previewToken: string | null | undefined;
  claimable: boolean;
  doorCode?: string;
}): boolean {
  const token = (input.previewToken ?? "").trim().toLowerCase();
  const cookieOpen = input.previewCookie === input.slug && token.length > 0 && input.claimable;
  if (!cookieOpen) return false;
  if (input.doorCode === undefined) return true;
  const code = input.doorCode.trim().toLowerCase();
  return code.length > 0 && code === token;
}
