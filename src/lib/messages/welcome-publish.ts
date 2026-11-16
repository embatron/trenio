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

export type WelcomePairThread = {
  id: string;
  portal: boolean;
  messages: number;
};

/**
 * One pair keeps one thread. A letter already in the portal thread is not sent again.
 * An empty card thread of the same pair is dropped. A thread that already has messages
 * is left as the only dialog, without a second welcome.
 */
export function planTrainerWelcome(threads: WelcomePairThread[]): {
  create: boolean;
  conversationId: string | null;
  dropIds: string[];
} {
  const portal = threads.find((thread) => thread.portal);
  const rest = threads.filter((thread) => thread.id !== portal?.id);
  const empty = rest.filter((thread) => thread.messages === 0).map((thread) => thread.id);
  if (portal && portal.messages > 0) return { create: false, conversationId: null, dropIds: empty };
  if (portal) return { create: false, conversationId: portal.id, dropIds: empty };
  if (rest.some((thread) => thread.messages > 0)) return { create: false, conversationId: null, dropIds: empty };
  return { create: true, conversationId: null, dropIds: empty };
}
