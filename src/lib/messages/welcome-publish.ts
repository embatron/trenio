/** The portal letter is due once: the card enters the catalog with an owner, or the owner is attached to a card that is already there. */
export function shouldSendPublishWelcome(input: {
  previous: string | null;
  next: string;
  hasOwner: boolean;
  ownerAttached?: boolean;
}): boolean {
  if (!input.hasOwner || input.next !== "published") return false;
  if (input.previous == null || input.previous === "draft") return true;
  return Boolean(input.ownerAttached) && input.previous === "published";
}
