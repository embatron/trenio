import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";

/**
 * Authenticator for staff. Off until the product turns it on.
 * Trainers and clients never see this step.
 */
export const STAFF_TOTP_REQUIRED = false;

export function staffNeedsTotp(roles: readonly UserRole[], totpEnabled: boolean): boolean {
  return STAFF_TOTP_REQUIRED && isStaff(roles) && !totpEnabled;
}

/** A second code at login, only when the switch is on and the account already has the app. */
export function staffTotpAtLogin(roles: readonly UserRole[], totpEnabled: boolean): boolean {
  return STAFF_TOTP_REQUIRED && isStaff(roles) && totpEnabled;
}
