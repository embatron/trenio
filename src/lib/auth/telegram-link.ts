export type TelegramBindDecision = "link" | "same" | "taken" | "replace-blocked";

/** Whether this Telegram id may be stored on the signed-in account. */
export function decideTelegramBind(input: {
  userId: string;
  incomingId: number;
  currentId: number | null;
  ownerId: string | null;
}): TelegramBindDecision {
  if (input.ownerId && input.ownerId !== input.userId) return "taken";
  if (input.currentId != null && input.currentId !== input.incomingId) return "replace-blocked";
  if (input.ownerId === input.userId) return "same";
  return "link";
}

export function cleanTelegramUsername(value: string | null | undefined): string | null {
  const clean = (value ?? "").replace(/^@/, "").trim().slice(0, 64);
  return clean || null;
}
