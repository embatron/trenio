export function trainerDoorClaimable(input: {
  ownerUserId: string | null;
  status: string;
}): boolean {
  return input.ownerUserId == null && (input.status === "draft" || input.status === "published");
}
