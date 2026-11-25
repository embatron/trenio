/** Green seal: the card is verified and the owner confirmed a mailbox or a Belarus mobile. */
export function trainerAccountReady(input: {
  verified: boolean;
  emailVerifiedAt?: Date | string | null;
  phoneVerifiedAt?: Date | string | null;
}): boolean {
  const confirmed = input.emailVerifiedAt != null || input.phoneVerifiedAt != null;
  return input.verified && confirmed;
}
