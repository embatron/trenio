/** Own message stays editable for this long after it is stored. */
export const MESSAGE_EDIT_MS = 15 * 60 * 1000;

export type PairCandidate = {
  id: string;
  trainerProfileId: string | null;
  messages: number;
  activityAt: number;
};

/**
 * One pair of accounts keeps a single thread.
 * A thread that already has messages wins. An empty duplicate is dropped.
 */
export function pickPairThread(
  rows: PairCandidate[],
  profileId: string,
): { keepId: string; dropIds: string[] } | null {
  if (rows.length === 0) return null;
  const ranked = [...rows].sort((left, right) => {
    if (left.messages !== right.messages) return right.messages - left.messages;
    const leftCard = left.trainerProfileId === profileId ? 1 : 0;
    const rightCard = right.trainerProfileId === profileId ? 1 : 0;
    if (leftCard !== rightCard) return rightCard - leftCard;
    return right.activityAt - left.activityAt;
  });
  const keep = ranked[0];
  return {
    keepId: keep.id,
    dropIds: rows.filter((row) => row.id !== keep.id && row.messages === 0).map((row) => row.id),
  };
}

export function messageEditable(createdAt: string, mine: boolean, deleted: boolean, now = Date.now()) {
  if (!mine || deleted) return false;
  const at = new Date(createdAt).getTime();
  if (!Number.isFinite(at) || at > now) return false;
  return now - at <= MESSAGE_EDIT_MS;
}

/** Bound pattern for ILIKE. Null until two characters are typed. */
export function messageSearchPattern(raw: string | undefined) {
  const cleaned = raw?.trim().slice(0, 80) ?? "";
  if (cleaned.length < 2) return null;
  return `%${cleaned.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
